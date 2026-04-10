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

const Didact = { createElement, render }

const element = Didact.createElement(
  "div",
  { style: "background: salmon; padding: 20px; border-radius: 8px;" },
  Didact.createElement("h1", null, "Mission 1: Success!"),
  Didact.createElement("p", null, "If you can see this, your DOM creation is working.")
)

const container = document.getElementById("root")
Didact.render(element, container)
