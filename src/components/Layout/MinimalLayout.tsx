import * as React from 'react'

function MinimalLayout(props: any) {
  return React.createElement("div", null, 
    React.createElement("h1", null, "Minimal Layout"),
    React.createElement("div", null, props.children)
  )
}

export default MinimalLayout 