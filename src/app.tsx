import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './components/ui/button';

const root = createRoot(document.body);
root.render(
  <div>
    <h2 className='mb-4'>Hello from React!</h2>
    <Button>Click me</Button>
  </div>
);
