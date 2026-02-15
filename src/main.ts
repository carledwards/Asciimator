import { App } from './App';

const appElement = document.getElementById('app');
if (appElement) {
  const app = new App(appElement);
  app.init();
}
