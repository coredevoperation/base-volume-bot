
import * as instance from './bot.js'
import dotenv from 'dotenv'
import assert from 'assert';
import * as utils from './utils.js';

dotenv.config()

const getWelcomeMessage = () => {
	return `This is the official alphAi bot deployed by <a href="http://alphai.site/">${process.env.BOT_NAME}</a>.

Only group owner can manipulate this bot via the following commands:

/${instance.COMMAND_START}@${instance.myInfo.username} - welcome 😀
/${instance.COMMAND_STARTKICK}@${instance.myInfo.username}- remove users from this group who sold tokens or hold less than 2.5 M tokens ❌
/${instance.COMMAND_STOPKICK}@${instance.myInfo.username}- stop removing users from this group who sold tokens or hold less than 2.5 M tokens ❌

Tutorial: Coming Soon
 
Important:
- To receive notifications or stay in the group, users hold at least ${instance.MIN_COMUNITY_TOKEN_AMOUNT} community tokens. Here's the <a href="https://www.dextools.io/app/en/ether/pair-explorer/0x695051b0028d02172d0204c964b293d7b25b6710">link</a> to buy
- In order to use this bot, group owner need to create a Telegram ID if he or she haven't already.

More commands will be added as the community grows. Please stay tuned for updates.`;
}


function sendGroupAuthMessage(session) {
	instance.sendMessage(session.from_chatid, `Please login <a href="${process.env.API_URI}/login?chatid=${session.chatid}">here</a> for the @${session.username} group subscription`)
}

const getGroupSuspensionMessage = () => {

	return `Hello users! We are sorry to let you know that we can no longer support our bot in the group chat. Please add the bot in your private chat instead. Thank you for your understanding`
}

export const procMessage = async (msg, database) => {

	const pub_chatid = msg?.chat?.id.toString();
	const from_chatid = msg?.from?.id.toString();

	let session = instance.sessions.get(pub_chatid)

	if (msg.new_chat_title) {
		// Changed the Group title
		if (session) {
			session.username = msg.new_chat_title
			await database.updateUser(session)
		}

		return
	}

	if (msg.left_chat_participant) {
		// This bot has been kicked out

		if (msg.left_chat_participant.id.toString() === instance.myInfo.id.toString()) {
			if (session) {
				await database.removeUser(session);
				instance.sessions.delete(session.chatid);
			}
		}

		return
	}

	if (msg.new_chat_participant) {
		const newParticipant = msg.new_chat_participant
		const newParticipantId = newParticipant.id.toString()
		if (newParticipant.is_bot === false && session) {

			let newSession = await database.selectUser({chatid: newParticipantId})

			if (newSession) {

				let communityTokenBalance = await utils.getTokenBalanceFromWallet(utils.web3Inst, newSession.wallet, process.env.COMUNITY_TOKEN);

				if (communityTokenBalance < Number(process.env.MIN_COMUNITY_TOKEN_AMOUNT) && newSession.vip !== 1) {
	
					setTimeout(async () => {
						
						try {
							const res = await instance.bot.unbanChatMember(session.chatid, newSession.chatid)
							if (res) {
			
								const message = `Hi @${newParticipant.username}!
In order to keep stay in the group, possessing a minimum of ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} units of the community's token in your wallet is requisite. You are removed from the group. Please login again to the @alphAI_Token_Bot. 
Please login to @alphAI_Token_Bot. Thank you for understanding`
			
								instance.sendMessage(newParticipantId, message)
								instance.sendMessage(session.chatid, `New joinee, @${newParticipant.username} has been kicked out from this group due insufficient balance of community tokens.`)
			
								console.log(`New joinee, @${newParticipant.username} has been kicked out from the group(${session.username})`)
							}
						} catch (err) {
	
						}
					}
					, 10000)
				}

			} else {

				instance.sendMessage(newParticipantId, 'Please do login to the alphAI bot using /login command')

				const message = `@${newParticipant.username}! Welcome to the group! We've noticed you are new joinee. We require you login to the @alphAI_Token_Bot first`
				instance.sendMessage(session.chatid, message)

				console.log(`@${newParticipant.username} is looking around the group (${session.username})`)
			}
		} 
	}

	let groupName = msg?.chat?.title;

	if (!msg.text || !msg.entities) {
		return;
	}

	let command = msg.text;
	for (const entity of msg.entities) {
		if (entity.type === 'bot_command') {
			command = command.substring(entity.offset, entity.offset + entity.length);
			break;
		}
	}

	let params = ''

	if (!command.includes('@')) {
		return;
	}

	const parts = command.split('@');

	if (parts.length !== 2) {
		return;
	}

	command = parts[0];
	if (parts[1] !== instance.myInfo.username) {
		return;
	}

	if (!from_chatid || !groupName) {
		return;
	}

	let chatMember = null;
	try {
		chatMember = await instance.bot.getChatMember(pub_chatid, from_chatid);
	} catch (err) {
		return;
	}

	let isOwner = (chatMember.status === 'creator' || chatMember.status === 'administrator');

	let isGroupCreatedOrBotAdded = (msg?.group_chat_created || msg?.supergroup_chat_created || msg?.new_chat_member?.id === instance.myInfo.id );
	let isBotLeftFromGroup = (msg.left_chat_member && msg.left_chat_member.id === bot.options.id) || (msg.banned_chat_member && msg.banned_chat_member.id === bot.options.id);
	
	if (isBotLeftFromGroup && session) {

		await database.removeGroup(session);
		instance.sessions.delete(session.chatid);

        instance.sendMessage(pub_chatid, 'Bot has been left the group chat');
		return;

	} else if (!session) {

		if (!groupName) {
			console.log(`Rejected anonymous group incoming connection. chatid = ${pub_chatid}`);
			//instance.sendMessage(chatid, `Welcome to alphAI bot. We noticed that your group does not have a username. Please create it and try again. If you have any questions, feel free to ask the developer team at @PurpleDragon999. Thank you.`)
			return;
		}

		// instance.sendMessage(pub_chatid, getGroupSuspensionMessage())
		// return

		// if (false && !await instance.checkWhitelist(groupName)) {

		// 	//instance.sendMessage(from_chatid, `😇Sorry, but @${groupName} group does not have permission to use alphBot. If this group would like to use this bot, please contact the developer team at ${process.env.TEAM_TELEGRAM}. Thanks!`);
		// 	console.log(`Rejected anonymous incoming connection. @${groupName}, ${pub_chatid}, ${from_chatid}`);
		// 	return;	
		// }

		console.log(`@${groupName} session has been permitted through whitelist`);

		session = instance.createSession(pub_chatid, groupName, 'group');
		session.permit = 1;
		session.from_chatid = from_chatid;

		await database.updateUser(session)
		
	} else {

		if (session.adminid !== from_chatid) {
			session.adminid = from_chatid;
			await database.updateUser(session)
		}
	}

    if (isGroupCreatedOrBotAdded) {

		//sendOptionMessage(pub_chatid, getWelcomeMessage(true), json_botSettings(from_chatid));
		instance.sendMessage(pub_chatid, 'Dear members! I am here for removing users from the group who have less than 2.5 million alphAI tokens. Thank you for your understanding.')
		// instance.sendMessage(pub_chatid, getGroupSuspensionMessage())

		return;
	}

    if (!isOwner) {
		//instance.sendMessage(from_chatid, 'Only group owner can control the bot.');
		return;  
	}

	//instance.sendMessage(pub_chatid, getGroupSuspensionMessage())

	command = command.slice(1);
    if (command === instance.COMMAND_START) {
        instance.sendMessage(pub_chatid, getWelcomeMessage())
    } else if (command === instance.COMMAND_STARTKICK) {
		instance.sendMessage(pub_chatid, 'Kick mode enabled')
		console.log(`Kick mode enabled in the group @${session.username}`)

		session.kickmode = 1

		await database.updateUser(session)

	} else if (command === instance.COMMAND_STOPKICK) {

		session.kickmode = undefined
		await database.updateUser(session)

		console.log(`Kick mode disabled in the group @${session.username}`)
		instance.sendMessage(pub_chatid, 'Kick mode disabled')
	}
}