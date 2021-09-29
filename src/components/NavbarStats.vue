<template>
  <div class="navbar-stats">
    <div class="evt-chart"><vuestro-area-chart :data="stats" :options="eventOptions"></vuestro-area-chart></div>
    <div class="cpu-chart"><vuestro-area-chart :data="stats" :options="cpuOptions"></vuestro-area-chart></div>
    <div class="mem-chart"><vuestro-area-chart :data="stats" :options="memOptions"></vuestro-area-chart></div>
  </div>
</template>

<script>

/* global Vuex, Vue */

export default {
  name: 'NavbarStats',
  data() {
    return {
      cpuOptions: {
        categoryField: 'ts',
        slide: true,
        transition: 5000,
        series: [
          {
            title: 'CPU',
            field: 'cpu',
            render(d) {
              return `${d}%`;
            },
          },
        ],
      },
      memOptions: {
        categoryField: 'ts',
        slide: true,
        transition: 5000,
        series: [
          {
            title: 'Memory',
            field: 'memory',
            color: "var(--vuestro-purple)",
            render: Vue.filter('vuestroBytes'),
          },
        ],
      },
      eventOptions: {
        categoryField: 'ts',
        slide: true,
        transition: 5000,
        series: [
          {
            title: 'Events',
            field: 'events',
            color: "var(--vuestro-orange)",
          },
        ],
      },
    };
  },
  computed: {
    ...Vuex.mapGetters(['stats']),
  }
};

</script>

<style scoped>

.navbar-stats {
  display: flex;
  flex: 1;
  height: calc(var(--vuestro-navbar-height) - 10px);
  margin-right: 5px;
  overflow: hidden;
}

.navbar-stats > div {
  margin: 4px;
  display: flex;
  flex: 1;
  position: relative;
  background-color: var(--vuestro-light-med);
  overflow: hidden;
  color: var(--vuestro-text-color);
}
.vuestro-dark .navbar-stats > div {
  background-color: var(--vuestro-darker);
}

.cpu-chart:before {
  content: "CPU";
  position: absolute;
  top: 2px;
  left: 5px;
}

.mem-chart:before {
  content: "Memory";
  position: absolute;
  top: 2px;
  left: 5px;
}

.evt-chart:before {
  content: "Events";
  position: absolute;
  top: 2px;
  left: 5px;
}

</style>