import { useState } from 'react'
import './App.css'
import LHApp from './components/LHApp'

function App() {
  const [count, setCount] = useState(0)

  return (
    <LHApp />
  )
}

export default App
