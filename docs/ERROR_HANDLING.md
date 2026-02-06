# Error Handling

## Overview

The UI uses React Error Boundaries to gracefully handle component errors and prevent the entire application from crashing.

## Error Boundary Hierarchy

### Root Error Boundary

Located in `packages/ui/src/main.tsx`, wraps the entire application:

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Features:**
- Full-screen error UI with stack trace
- "Try Again" button to reset error state
- "Reload Page" button for hard reset
- Detailed error information for debugging
- Help text with troubleshooting steps

**When it catches:**
- Unhandled errors that bubble up from any component
- Errors in React lifecycle methods
- Errors in constructors
- Errors in render methods

### Component Error Boundaries

Located throughout `CommandCenter.tsx`, wraps individual components:

```tsx
<ComponentErrorBoundary componentName="Task Queue">
  <TaskQueue />
</ComponentErrorBoundary>
```

**Features:**
- Compact inline error UI
- Component name in error message
- Retry button for quick recovery
- Stack trace in collapsible details
- Doesn't disrupt other components

**Protected components:**
- Minimap
- Sidebar
- Task Queue
- Active Missions
- Tool Log
- Token Burn Log
- Micromanager View
- Dashboard
- Alerts Panel
- Chat Panel

## Error Boundary Behavior

### What Error Boundaries Catch

✅ **Caught:**
- Errors during rendering
- Errors in lifecycle methods (componentDidMount, etc.)
- Errors in constructors
- Errors in event handlers (if they trigger a render)

❌ **Not Caught:**
- Errors in async code (use try/catch)
- Errors in event handlers (use try/catch)
- Server-side rendering errors
- Errors in the error boundary itself

### Example: Async Error Handling

Error boundaries don't catch async errors, so use try/catch:

```tsx
const handleSubmit = async () => {
  try {
    await api.createTask(data);
  } catch (error) {
    console.error('Failed to create task:', error);
    // Show error toast/alert to user
  }
};
```

## Adding Error Boundaries to New Components

### When to Use Root Error Boundary

Use for top-level application errors:

```tsx
// main.tsx or App.tsx
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

### When to Use Component Error Boundary

Use for individual features that can fail independently:

```tsx
// Any component that could fail without breaking others
<ComponentErrorBoundary componentName="Feature Name">
  <YourFeature />
</ComponentErrorBoundary>
```

### Custom Fallback UI

Both error boundaries support custom fallback UI:

```tsx
<ErrorBoundary
  fallback={
    <div>Something went wrong. Please refresh.</div>
  }
>
  <App />
</ErrorBoundary>

<ComponentErrorBoundary
  componentName="Widget"
  fallback={<div>Widget failed to load</div>}
>
  <Widget />
</ComponentErrorBoundary>
```

### Error Callbacks

Handle errors programmatically:

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Send to logging service
    logErrorToService(error, errorInfo);

    // Track in analytics
    trackError(error.message);
  }}
>
  <App />
</ErrorBoundary>
```

## Error Logging

### Console Logging

All error boundaries log to console automatically:

```
ErrorBoundary caught an error: TypeError: Cannot read property 'map' of undefined
  at TaskQueue.render (TaskQueue.tsx:45)
  ...
```

### Production Error Tracking

To add error tracking (Sentry, LogRocket, etc.):

1. Install tracking service:
```bash
npm install @sentry/react
```

2. Initialize in `main.tsx`:
```tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: import.meta.env.MODE,
});
```

3. Update error boundary callback:
```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    Sentry.captureException(error, {
      contexts: { react: errorInfo },
    });
  }}
>
  <App />
</ErrorBoundary>
```

## Testing Error Boundaries

### Manual Testing

Create a component that throws an error:

```tsx
function ErrorTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Test error!');
  }

  return (
    <button onClick={() => setShouldThrow(true)}>
      Trigger Error
    </button>
  );
}

// In CommandCenter.tsx
<ComponentErrorBoundary componentName="Test">
  <ErrorTrigger />
</ComponentErrorBoundary>
```

### Automated Testing

Test error boundaries with React Testing Library:

```tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowError() {
  throw new Error('Test error');
}

test('renders error UI when child throws', () => {
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/System Error Detected/i)).toBeInTheDocument();
  expect(screen.getByText(/Test error/i)).toBeInTheDocument();
});
```

## Best Practices

1. **Wrap at appropriate levels**
   - Root boundary for catastrophic errors
   - Component boundaries for independent features

2. **Provide helpful error messages**
   - Use descriptive component names
   - Include troubleshooting steps in fallback UI

3. **Don't overuse**
   - Too many boundaries = harder to debug
   - Only wrap components that truly can fail independently

4. **Handle async errors separately**
   - Use try/catch for promises
   - Use .catch() for fetch/API calls

5. **Log errors for debugging**
   - Console logs in development
   - Error tracking service in production

6. **Test error states**
   - Manually trigger errors during development
   - Write tests for error boundary behavior

## Troubleshooting

### Error boundary not catching error

**Possible causes:**
- Error is in async code (not caught by boundaries)
- Error is in event handler (use try/catch)
- Error boundary is defined incorrectly

### "Try Again" doesn't work

**Solution:**
- Ensure the error cause is fixed before retry
- For persistent errors, use "Reload Page" instead
- Check if error is in component setup (constructor/mount)

### Stack trace shows wrong location

**Solution:**
- Enable source maps in Vite config
- Use production build to see minified locations
- Check browser dev tools for better stack traces
