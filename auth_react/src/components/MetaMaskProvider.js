import React, { useEffect, useState } from 'react'
import MetaMaskOnboarding from '@metamask/onboarding'
import { Alert, Button } from 'react-bootstrap'
import { useLocation } from 'react-router-dom'

const WALLET_DISCONNECTED = 1
const WALLET_CONNECTING = 2
const WALLET_CONNECTED = 3

const AUTH_URL = 'https://botlogin.alphai.support/api/auth'

export const MetaMaskProvider = (props) => {
  const [isMetaMaskInstalled, setMetaMaskInstalled] = useState(false)
  const [walletConnectState, setWalletConnectState] = useState(WALLET_DISCONNECTED)
  const [connectedWalletAddress, setConnectedWalletAddress] = useState(null)
  const [chatId, setChatId] = useState(null)
  const [alertMessage, setAlertMessage] = useState(null)

  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)

  window.ethereum?.on('accountsChanged', async (accounts) => {
    try {
      const accounts = await window.ethereum?.request({ method: 'eth_accounts' })
      if (accounts?.[0]) {
        setConnectedWalletAddress(accounts[0])
      } else {
        setConnectedWalletAddress(null)
      }
    } catch (error) {
      console.error(error)
      showAlertMessage(error.message)
    }
  })

  const connectWallet = async () => {
    try {
      setWalletConnectState(WALLET_CONNECTING)

      const accounts = await window.ethereum?.request({ method: 'eth_requestAccounts' })
      if (accounts?.[0]) {
        setConnectedWalletAddress(accounts[0])
      } else {
        setConnectedWalletAddress(null)
      }

      setWalletConnectState(WALLET_CONNECTED)
    } catch (error) {
      console.error(error)
      showAlertMessage(error.message)

      setWalletConnectState(WALLET_DISCONNECTED)
    }
  }

  const sendWalletInfo = async (chatId, connectedWalletAddress) => {
    try {
      if (chatId && connectedWalletAddress) {
        const res = await fetch(AUTH_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              "chatid": chatId,
              "wallet": connectedWalletAddress,
            }),
          })
        const resData = await res.json()
        if (!resData.error) {
          alert(resData.message)
        } else {
          alert(resData.message);
          setConnectedWalletAddress(null);
          setWalletConnectState(WALLET_DISCONNECTED);
          //window.close();
        }
      }
    } catch (error) {
      console.error(error)
      showAlertMessage(error.message)
    }
  }

  const showAlertMessage = (message) => {
    alert(message)
    // setAlertMessage(message)
    // setTimeout(() => setAlertMessage(null), 3000)
  }

  useEffect(() => {
    setChatId(queryParams.get('chatid'))
  
    setMetaMaskInstalled(MetaMaskOnboarding.isMetaMaskInstalled())
  }, [])

  useEffect(() => {
    (async () => {
      await sendWalletInfo(chatId, connectedWalletAddress)
    })()
  }, [connectedWalletAddress])

  return (
    <div>
      {!chatId && (
        <>
          {/* <Alert variant='dangerous'>
            {`Sorry but we can't find your chat id. Please reconnect from your telegram.`}
          </Alert> */}
        </>
      )}
      {chatId && (
        <>
          {!isMetaMaskInstalled && (
            <>
              <p> MetaMask is not installed. Please install MetaMask. </p>
            </>
          )}
          {isMetaMaskInstalled &&
            <>
              {walletConnectState === WALLET_DISCONNECTED && (
                <>
                  <Button onClick={connectWallet}>
                    Connect to MetaMask
                  </Button>
                </>
              )}
              {walletConnectState === WALLET_CONNECTING && (
                <>
                  <Button className={''} disabled={true}>
                    Connecting to MetaMask
                  </Button>
                </>
              )}
              {walletConnectState === WALLET_CONNECTED && (
                <>
                  <p> Connected to MetaMask </p>
                  <p> {`${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-4)}`} </p>
                </>
              )}
            </>
          }
        </>
      )}
      {alertMessage && (
        <>
          <Alert variant='warning'>
            {alertMessage}
          </Alert>
        </>
      )}
    </div>
  )
}