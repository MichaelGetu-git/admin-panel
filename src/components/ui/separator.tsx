'use client'

import * as React from 'react'

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = '', orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={
        orientation === 'horizontal'
          ? `h-px w-full bg-border ${className}`
          : `h-full w-px bg-border ${className}`
      }
      {...props}
    />
  ),
)
Separator.displayName = 'Separator'

export { Separator }
