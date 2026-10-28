import axios from 'axios';

export const api = axios.create({
  baseURL: '/', // Aponta para os mocks do MSW no ambiente local
  timeout: 10000,
});