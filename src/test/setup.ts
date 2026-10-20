import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Route-level lazy imports may need longer than one second on the desktop host.
configure({ asyncUtilTimeout: 3000 });
