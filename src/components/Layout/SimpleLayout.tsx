import * as React from 'react'
import { ReactNode } from 'react'

interface SimpleLayoutProps {
  children: ReactNode
}

const SimpleLayout: React.FC<SimpleLayoutProps> = ({ children }) => {
  return (
    <div>
      <h1>Simple Layout Works</h1>
      <div>{children}</div>
    </div>
  )
}

export default SimpleLayout 