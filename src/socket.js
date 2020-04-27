/* global io */

import store from './store';
import * as io from 'socket.io-client/dist/socket.io.js';

export default {
  install(Vue, options) {

    Vue.socket = io('', {
      path: '/volante-dashboard/socket.io',
    });

    // handler for volante events
    Vue.socket.on('*', (...args) => {
      store.dispatch('addEvent', args);
    });

    // handle msg with volante-dashboard specific info
    Vue.socket.on('volante-dashboard.info', (d) => {
      store.dispatch('setTitle', d.title);
      store.dispatch('setVersion', d.version);
    });

    // handler for volante wheel info (spokes, stats, etc)
    Vue.socket.on('volante.info', (d) => {
      store.dispatch('setTopology', d.wheel);
      store.dispatch('setUptime', d.uptime);
      store.dispatch('setStats', d.stats);
    });

    Vue.socket.on('callback-result', (d) => {
      store.dispatch('setLastCallbackResult', d);
    });
  }
};