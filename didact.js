function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = null

function render(element, container) {
  // Do not touch the DOM here: only seed the work-in-progress root so the scheduler can reconcile in slices.
  wipRoot = {
    dom: container,
    props: { children: [element] },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

function commitRoot() {
  // First remove every node marked for deletion so the live tree matches the new virtual tree.
  deletions.forEach(commitWork)
  // Walk the new fiber tree from the first real child of the wip root and apply all DOM effects.
  commitWork(wipRoot.child)
  // The work-in-progress tree is now the committed tree shown in the browser.
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) return

  // Function components have no DOM node; walk up to the nearest ancestor that owns a DOM element.
  let domParentFiber = fiber.parent
  while (domParentFiber && !domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    // Brand-new node: attach it under the correct parent in one atomic pass with the rest of the tree.
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    // Same DOM node as last render: patch props instead of replacing the element.
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "DELETION") {
    // Node type changed or list shrank: remove the old subtree from the document.
    commitDeletion(fiber, domParent)
  }

  // Depth-first: finish this subtree before moving sideways to siblings.
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    // Host fiber (e.g. div): remove its DOM node directly.
    domParent.removeChild(fiber.dom)
  } else if (fiber.child) {
    // Function component fiber has no dom; drill into its child host tree to find a real node to remove.
    commitDeletion(fiber.child, domParent)
  }
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  scheduleWork()
}

function scheduleWork() {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(workLoop)
  } else {
    setTimeout(() => workLoop({ timeRemaining: () => 5 }), 0)
  }
}

scheduleWork()

const isEvent = (key) => key.startsWith("on")
const isProperty = (key) => key !== "children" && !isEvent(key)
const isNew = (prev, next) => (key) => prev[key] !== next[key]
const isGone = (prev, next) => (key) => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = ""
    })

  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)
  return dom
}

let wipFiber = null
let hookIndex = null

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = typeof action === "function" ? action(hook.state) : action
  })

  const setState = (action) => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    deletions = []
    nextUnitOfWork = wipRoot
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null

    const sameType = oldFiber && element && element.type == oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      if (newFiber) wipFiber.child = newFiber
    } else if (newFiber) {
      prevSibling.sibling = newFiber
    }

    if (newFiber) {
      prevSibling = newFiber
    }

    index++
  }
}

const Didact = { createElement, render, useState }
const container = document.getElementById("root")

function Greeting(props) {
  return Didact.createElement(
    "h1",
    { style: "color: green;" },
    "Mission 4: Hello, ",
    props.name,
    "!"
  )
}

const App = Didact.createElement(Greeting, { name: "Function Components" })
Didact.render(App, container)
