import * as fs from 'fs';
import * as path from 'path';

export interface Fixture {
  request: {
    method: string;
    path: string;
    parameters: Record<string, any>;
  };
  response: {
    status: number;
    body: any;
  };
}

export function loadFixture(resourceName: string, operationName: string, exampleIndex: number = 0): Fixture {
  const fixtureName = `${resourceName}-${operationName}-${exampleIndex}.json`;
  const fixturePath = path.join(__dirname, 'fixtures', fixtureName);
  
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixtureName}`);
  }
  
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(fixtureContent);
}

export function fixtureExists(resourceName: string, operationName: string, exampleIndex: number = 0): boolean {
  const fixtureName = `${resourceName}-${operationName}-${exampleIndex}.json`;
  const fixturePath = path.join(__dirname, 'fixtures', fixtureName);
  return fs.existsSync(fixturePath);
}
