import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MetaMaskProvider } from './components/MetaMaskProvider'
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className='container'>
          <BrowserRouter>
            <Routes>
              <Route path='/login' Component={MetaMaskProvider} />
            </Routes>
          </BrowserRouter>
        </div>
      </header>
    </div>
  );
}

export default App;
