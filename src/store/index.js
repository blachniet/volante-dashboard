/* global _, Vue, Vuex, localStorage */
Vue.use(Vuex);

const localStorageId = 'volante-dashboard';

export default new Vuex.Store({
  state: {
    title: 'volante',
    version: '0.0.0',
    events: [],
    logEvents: [],
    stats: [],
    uptime: null,
    topology: [],
    topologyNodelist: {
      nodes: [],
      links: [],
    },
    savedLoaded: false,
    savedEvents: {},
    savedSettings: {
      isMiniSidebar: false,
      eventSortAsc: true,
    },
    isDarkUI: true,
  },
  getters: {
    title(state) {
      return state.title;
    },
    version(state) {
      return state.version;
    },
    events(state) {
      return state.events;
    },
    logEvents(state) {
      return state.logEvents;
    },
    stats(state) {
      return state.stats;
    },
    uptime(state) {
      return state.uptime;
    },
    topology(state) {
      return state.topology;
    },
    topologyNodelist(state) {
      return state.topologyNodelist;
    },
    lastEvent(state) {
      return state.events[state.events.length-1];
    },
    errorLogs(state) {
      return _.filter(state.logEvents, function(o) {
        return o.eventArgs[0].lvl === 'error';
      });
    },
    allHandledEvents(state) {
      let ret = [];
      for (let m of state.topology) {
        if (m.handledEvents) {
          for (let e of m.handledEvents) {
            if (e && !e.startsWith('*')) {
              ret.push(e);
            }
          }
        }
      }
      return _.uniq(ret);
    },
    isMiniSidebar(state) {
      return state.savedSettings.isMiniSidebar;
    },
    isSavedLoaded(state) {
      return state.savedLoaded;
    },
    savedEvents(state) {
      return state.savedEvents;
    },
    eventSortAsc(state) {
      return state.savedSettings.eventSortAsc;
    },
    isDarkUI(state) {
      return state.isDarkUI;
    },
  },
  actions: {
    loadSavedSettings({ commit }) {
      let obj = JSON.parse(localStorage.getItem(localStorageId));
      commit('loadSavedSettings', obj);
    },
    setTitle({ commit }, title) {
      commit('setTitle', title);
    },
    setVersion({ commit }, version) {
      commit('setVersion', version);
    },
    addEvent({ commit }, args) {
      commit('addEvent', args);
    },
    clearEvents({ commit }) {
      commit('clearEvents');
    },
    clearLogEvents({ commit }) {
      commit('clearLogEvents');
    },
    setStats({ commit }, stats) {
      commit('setStats', stats);
    },
    setUptime({ commit }, uptime) {
      commit('setUptime', uptime);
    },
    setTopology({ commit }, topology) {
      commit('setTopology', topology);
    },
    toggleSidebar({ commit }) {
      commit('toggleSidebar');
    },
    saveEvent({ commit }, obj) {
      commit('saveEvent', obj);
    },
    deleteSavedEvent({ commit }, key) {
      commit('deleteSavedEvent', key);
    },
    toggleEventSortDirection({ commit }) {
      commit('toggleEventSortDirection');
    },
    toggleIsDarkUI({ commit }) {
      commit('toggleIsDarkUI');
    },
  },
  mutations: {
    loadSavedSettings(state, obj) {
      if (obj && obj.savedSettings) {
        _.merge(state.savedSettings, obj.savedSettings);
      }
      if (obj && obj.savedEvents) {
        _.merge(state.savedEvents, obj.savedEvents);
      }
      state.savedLoaded = true;
    },
    saveToLocalStorage(state) {
      localStorage.setItem(localStorageId, JSON.stringify({
        savedSettings: state.savedSettings,
        savedEvents: state.savedEvents,
      }));
    },
    setTitle(state, title) {
      state.title = title;
    },
    setVersion(state, version) {
      state.version = version;
    },
    addEvent(state, args) {
      let eventType = args[0]; // type is first arg, rest are the "args"
      let eventArgs = args.slice(1);
      if (eventType === 'volante.log' || eventType === 'error') {
        state.logEvents.push({
          ts: new Date(),
          eventType,
          eventArgs,
        });
      } else {
        state.events.push({
          ts: new Date(),
          eventType,
          eventArgs,
        });
      }
    },
    clearEvents(state) {
      state.events = [];
    },
    clearLogEvents(state) {
      state.logEvents = [];
    },
    setStats(state, stats) {
      state.stats = stats;
    },
    setUptime(state, uptime) {
      state.uptime = uptime;
    },
    setTopology(state, topology) {
      state.topology = topology;
      // reset nodelist
      state.topologyNodelist.nodes = [];
      state.topologyNodelist.links = [];

      let cnt = 0;
      for (let t of topology) {
        state.topologyNodelist.nodes.push(t);
        state.topologyNodelist.links.push({
          source: 0, // hub will always be the first entry, until we cluster
          target: cnt++,
        });
      }
    },
    toggleSidebar(state) {
      state.savedSettings.isMiniSidebar = !state.savedSettings.isMiniSidebar;
      this.commit('saveToLocalStorage');
    },
    saveEvent(state, obj) {
      Vue.set(state.savedEvents, obj.name, _.cloneDeep(obj));
      this.commit('saveToLocalStorage');
    },
    deleteSavedEvent(state, key) {
      Vue.delete(state.savedEvents, key);
      this.commit('saveToLocalStorage');
    },
    toggleEventSortDirection(state) {
      state.savedSettings.eventSortAsc = !state.savedSettings.eventSortAsc;
      this.commit('saveToLocalStorage');
    },
    toggleIsDarkUI(state) {
      state.isDarkUI = !state.isDarkUI;
    },
  },
});