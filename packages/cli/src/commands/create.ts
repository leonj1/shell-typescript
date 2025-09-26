import fs from 'fs';
import path from 'path';

export function createModule(name: string, template: string) {
  console.log(`Creating new module: ${name} with template: ${template}`);
  
  // Create module directory
  const moduleDir = path.join(process.cwd(), 'modules', name);
  fs.mkdirSync(moduleDir, { recursive: true });
  
  // Create basic module structure
  const moduleFiles = getTemplateFiles(template, name);
  
  for (const [filePath, content] of Object.entries(moduleFiles)) {
    const fullPath = path.join(moduleDir, filePath);
    fs.writeFileSync(fullPath, content);
  }
  
  console.log(`Module ${name} created successfully!`);
}

function getTemplateFiles(template: string, name: string): Record<string, string> {
  switch (template) {
    case 'basic':
      return {
        'index.ts': `import { IBusinessModule, IServiceContainer } from '@shell/interfaces';

export class ${name}Module implements IBusinessModule {
  readonly name = '${name}';
  readonly version = '1.0.0';
  readonly dependencies = [];

  async initialize(container: IServiceContainer): Promise<void> {
    // Initialize module services
  }

  getRoutes() {
    return [];
  }

  getComponents() {
    return [];
  }

  getMiddleware() {
    return [];
  }

  getApiEndpoints() {
    return [];
  }

  async destroy(): Promise<void> {
    // Cleanup module resources
  }
}
`,
        'package.json': `{
  "name": "${name}-module",
  "version": "1.0.0",
  "main": "index.ts",
  "types": "index.ts",
  "dependencies": {
    "@shell/interfaces": "workspace:*"
  }
}`
      };
    default:
      return getTemplateFiles('basic', name);
  }
}