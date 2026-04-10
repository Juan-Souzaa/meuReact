/** @jsx Didact.createElement */

function Counter() {
  const [count, setCount] = Didact.useState(1)
  return (
    <div style="font-family: sans-serif; padding: 40px;">
      <h1>Count: {count}</h1>
      <button onClick={() => setCount((c) => c + 1)}>+ Increment</button>
      <button onClick={() => setCount((c) => c - 1)}>- Decrement</button>
    </div>
  )
}

const container = document.getElementById("root")
Didact.render(<Counter />, container)
