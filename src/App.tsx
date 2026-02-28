import { useState } from 'react'
import './App.css'
import LHApp from './components/LHApp'
import APITest from './components/APITest'

function App() {
  const [count, setCount] = useState(0)

  return (
    <LHApp />
    // <APITest />
  )
}

export default App
