<template>
  <vuestro-container no-wrap column shrink class="topology-container">
    <vuestro-card cols="6" color="var(--vuestro-gold)" overflow-hidden>
      <template #heading>
        Topology
        <vuestro-button round no-border @click="vuestroDownloadAsJson(topology, 'topology.json')">
          <vuestro-icon name="download"></vuestro-icon>
        </vuestro-button>
      </template>
      <vuestro-force-graph :data="topologyNodelist" :options="graphOptions" @select="onSelectSpoke"></vuestro-force-graph>
    </vuestro-card>
    <vuestro-card cols="6" overflow-hidden>
      <vuestro-panel stretch scroll>
        <template #title>Module Data</template>
        <template #toolbar>
          <vuestro-button pill no-border @click="$refs.ob.expandAll()">
            <template #icon>
              <vuestro-icon name="plus"></vuestro-icon>
            </template>
            Expand All
          </vuestro-button>
          <vuestro-button pill no-border @click="$refs.ob.collapseAll()">
            <template #icon>
              <vuestro-icon name="minus"></vuestro-icon>
            </template>
            Collapse All
          </vuestro-button>
          <vuestro-button round no-border @click="vuestroDownloadAsJson(selectedSpoke, 'spoke.json')">
            <vuestro-icon name="download"></vuestro-icon>
          </vuestro-button>
        </template>
        <div v-if="Object.keys(selectedSpoke).length == 0" class="no-data">Select a module to see its current state</div>
        <vuestro-object-browser v-else
                                ref="ob"
                                :data="selectedSpoke"
                                :options="{ editable: editableCheck }"
                                @edit="editing = true"
                                @done="editing = false"
                                @change="onDataChange">
          <template #post-value="{ k, v, parent}">
            <vuestro-button v-if="parent === 'handledEvents' || parent === 'emittedEvents'"
                            round
                            size="sm"
                            no-border
                            no-margin
                            @click="$refs.sendEvent.openForEvent(v)">
              <vuestro-icon name="share-square"></vuestro-icon>
            </vuestro-button>
          </template>
        </vuestro-object-browser>
      </vuestro-panel>
    </vuestro-card>
    <send-event ref="sendEvent"/>
  </vuestro-container>
</template>

<script>

/* global Vue, Vuex, _ */
import SendEvent from '@/components/SendEvent';

export default {
  name: 'Topology',
  components: {
    SendEvent,
  },
  data() {
    return {
      graphOptions: {
        labels: true,
        distance: 100,
      },
      selectedSpoke: {},  // the spoke data for the last clicked spoke node
      editing: false,     // prevent reactive updates while editing
    };
  },
  computed: {
    ...Vuex.mapGetters(['topology', 'topologyNodelist']),
  },
  watch: {
    topologyNodelist() {
      if (!this.editing) {
        this.updateSelectedSpoke();
      }
    },
  },
  methods: {
    onSelectSpoke(d) {
      this.selectedSpoke = d;
    },
    updateSelectedSpoke() {
      if (this.selectedSpoke && this.selectedSpoke.name) {
        this.selectedSpoke = _.find(this.topology, { name: this.selectedSpoke.name });
      }
    },
    onDataChange(k, v) {
      Vue.socket.emit('volante.spoke.update', {
        name: this.selectedSpoke.name,
        key: k,
        val: v,
      });
    },
    editableCheck(k, v) {
      return (k.startsWith('data.') || k.startsWith('props.'));
    },
  },
};

</script>

<style scoped>

.topology-container {
  overflow: hidden;
}

.no-data {
  font-size: 24px;
  font-weight: 200;
  align-self: center;
  margin-top: 10px;
}

</style>