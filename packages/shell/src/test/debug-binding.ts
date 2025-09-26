import { Container } from 'inversify';

// Create a container
const container = new Container();

// Create a binding
const binding = container.bind('test');

// Log the binding object to see what methods it has
console.log('Binding methods:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(binding)));

console.log('Binding keys:');
console.log(Object.keys(binding));