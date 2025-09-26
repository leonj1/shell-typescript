"use client";

import React from 'react';
import { useService } from '../../hooks/useService';
import { ILogger } from '@shell/interfaces';

export default function ExamplePage() {
  const logger = useService<ILogger>('Logger');
  
  React.useEffect(() => {
    logger.info('Example page loaded');
  }, [logger]);

  return (
    <div>
      <h1>Shell Architecture Example</h1>
      <p>This page demonstrates the use of the ServiceProvider and useService hook.</p>
    </div>
  );
}