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

function render(element, container) {
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type)

  if (element.type === "TEXT_ELEMENT") {
    dom.nodeValue = element.props.nodeValue
  } else {
    Object.keys(element.props)
      .filter((key) => key !== "children")
      .forEach((name) => {
        dom[name] = element.props[name]
      })
    element.props.children.forEach((child) => render(child, dom))
  }

  container.appendChild(dom)
}

let nextUnitOfWork = null
let wipRoot = null

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

function updateDom(dom, prevProps, nextProps) {
  Object.keys(nextProps)
    .filter((key) => key !== "children")
    .forEach((name) => {
      dom[name] = nextProps[name]
    })
  if (nextProps.nodeValue != null) {
    dom.nodeValue = nextProps.nodeValue
  }
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

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let prevSibling = null

  while (index < elements.length) {
    const element = elements[index]
    const newFiber = {
      type: element.type,
      props: element.props,
      dom: null,
      parent: wipFiber,
      alternate: null,
      effectTag: "PLACEMENT",
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

function commitRoot() {}

const fiberC = { type: "C", props: {} }
const fiberB = { type: "B", props: {}, child: fiberC }
const fiberD = { type: "D", props: {} }
const fiberA = { type: "A", props: {}, child: fiberB }

fiberC.parent = fiberB
fiberB.parent = fiberA
fiberD.parent = fiberA
fiberB.sibling = fiberD

const originalUpdateHost = updateHostComponent
updateHostComponent = (fiber) => {
  console.log("Visiting node:", fiber.type)
}

console.log("--- Starting Fiber Traversal Test ---")
let nextUnit = fiberA
while (nextUnit) {
  nextUnit = performUnitOfWork(nextUnit)
}
console.log("--- Traversal Finished ---")

updateHostComponent = originalUpdateHost
