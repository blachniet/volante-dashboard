<template>
  <vuestro-modal :active="active || isOpen" @close="onClose" close-on-blur>
		<template #title>Create Event</template>
		<template #toolbar>
      <save-event :eventType="sendEventType" :eventArgs="args" :provideCallback="provideCallback"></save-event>
		  <load-event @load="onLoadEvent"></load-event>
		</template>
		<vuestro-container>
			<vuestro-card>
				<vuestro-text-field variant="outline" size="lg" v-model="sendEventType" placeholder="Event Type" hint="e.g. hello.world">
				  <template #dropdown="{ closeDropdown }">
				    <vuestro-list-button v-for="e in allHandledEvents" :key="e" @click="() => { openForEvent(e); closeDropdown(); }">
  				    {{ e }}
				    </vuestro-list-button>
				  </template>
				</vuestro-text-field>
				<div style="height: 20px"></div>
  			<vuestro-panel gutter="none" collapsible>
  			  <template #title>Event Arguments (as JSON)</template>
  			  <template #toolbar>
  			    <vuestro-button round no-border @click="onAddArg">
  			      <vuestro-icon name="plus"></vuestro-icon>
  			    </vuestro-button>
  			  </template>
          <div v-for="(arg, idx) in args" class="event-arg-block">
            <div class="event-arg-sidebar">
              <span>{{ idx }}</span>
              <vuestro-button round no-border variant="danger" @click="onDeleteArg(idx)">
                <vuestro-icon name="trash"></vuestro-icon>
              </vuestro-button>
            </div>
    			  <div class="editor-wrapper" :style="{ height: arg.height }">
      				<vuestro-editor lang="json" :value="arg.buffer" :options="editorOptions" @input="onContentUpdate(idx, ...arguments)"></vuestro-editor>
    				</div>
    				<div class="event-arg-block-resize-handle"
    				     @mousedown="onArgResizeStart(idx, ...arguments)"></div>
          </div>
  			</vuestro-panel>
			</vuestro-card>
			<vuestro-card overflow-hidden>
			  <vuestro-container gutter="none">
  			  <vuestro-button checkbox v-model="provideCallback" size="sm">Append callback function argument</vuestro-button>
			  </vuestro-container>
			  <vuestro-panel v-if="provideCallback" collapsible overflow-hidden>
			    <template #title>Last Callback Result</template>
			    <template #toolbar>
			      <vuestro-pill v-if="lastCallbackResult && lastCallbackResult.elapsed"
			                    variant="capsule"
			                    size="sm">
			        <template #title>Elapsed</template>
			        <template #value>{{ lastCallbackResult.elapsed }}ms</template>
		        </vuestro-pill>
			      <vuestro-button round no-border @click="lastCallbackResult = null">
			        <vuestro-icon name="ban"></vuestro-icon>
			      </vuestro-button>
			      <vuestro-button round no-border @click="vuestroDownloadAsJson(lastCallbackResult.result, 'result.json')">
			        <vuestro-icon name="download"></vuestro-icon>
			      </vuestro-button>
			    </template>
			    <template v-if="lastCallbackResult && lastCallbackResult.result && lastCallbackResult.result.length === 2">
      			<template v-if="lastCallbackResult.result[0]">
      			  <span class="callback-error">ERROR</span>
      			  <vuestro-object-browser :data="lastCallbackResult.result[0]"></vuestro-object-browser>
      			</template>
			      <template v-else>
      			  <vuestro-object-browser :data="lastCallbackResult.result[1]"></vuestro-object-browser>
    			  </template>
  			  </template>
			    <div v-else class="waiting-for-callback">Waiting for callback result...</div>
			  </vuestro-panel>
			</vuestro-card>
		</vuestro-container>
		<template #buttons>
			<vuestro-button variant="success" :disabled="!valid || sendEventType.length === 0" @click="onSend">
			  <template #icon>
  				<vuestro-icon name="rocket"></vuestro-icon>
				</template>
				Send
			</vuestro-button>
		</template>
	</vuestro-modal>
</template>

<script>

/* global Vue, Vuex, Event, _ */
import SaveEvent from '@/components/SaveEvent';
import LoadEvent from '@/components/LoadEvent';

export default {
  name: 'SendEvent',
  components: {
    SaveEvent,
    LoadEvent,
  },
  props: {
    active: { type: Boolean, default: false },
  },
  data() {
    return {
      isOpen: false, // internal open flag
      valid: true,
  		sendEventType: '',
			sendEventArgs: [],
			args: [],
      editorOptions: {
        useSoftTabs: true,
        tabSize: 2,
      },
      provideCallback: false,
      resizingIdx: null,
      lastCallbackResult: null,
    };
  },
  computed: {
		...Vuex.mapGetters(['allHandledEvents']),
  },
  methods: {
    openForEvent(evt) {
      this.args = [];
      this.provideCallback = false;
      // see if there are arguments
      let sig = evt.match(/\((.*)\)/);
      if (sig && sig.length > 0 && sig[1].length > 0) {
        let args = sig[1].split(/, ?/);
        if (args) {
          if (args[args.length-1] === 'callback') {
            this.provideCallback = true;
            args.pop();
          }

          for (let a of args) {
            // add argument var name as starting buffer value
            this.args.push({
              buffer: `"${a}"`,
              height: '80px',
            });
          }
        }
      }
      this.sendEventType = evt.split('(')[0];
      this.isOpen = true;
    },
    openWithEvent(e) {
      this.args = [];
      this.provideCallback = false;
      this.sendEventType = e.eventType;
      for (let a of e.eventArgs) {
        this.args.push({
          buffer: JSON.stringify(a, null, 2),
          height: '80px',
        });
      }
      this.isOpen = true;
    },
    onClose() {
      // reset and close
      this.isOpen = false;
      this.$emit('update:active', false);
    },
    onContentUpdate(idx, newVal) {
      // update text
      this.args[idx].buffer = newVal;
      this.validateBuffers();
    },
    validateBuffers() {
      // try to validate as JSON
      try {
        this.sendEventArgs = [];
        for (let a of this.args) {
          this.sendEventArgs.push(JSON.parse(a.buffer));
        }
        this.valid = true;
      } catch(e) {
        this.valid = false;
      }
    },
    onSend() {
      this.validateBuffers();
      // send it server-side
      let st = new Date();
      let nonce = this.vuestroGenerateId(16);
      Vue.socket.emit('volante', {
        eventType: this.sendEventType,
        eventArgs: this.sendEventArgs,
        eventCallback: nonce,
      });
      if (!this.provideCallback) {
        // close if not waiting on callback result
        this.onClose();
      } else {
        Vue.socket.once(nonce, (d) => {
          console.log('got result!', d);
          this.lastCallbackResult = {
            elapsed: new Date() - st,
            result: d
          };
        });
      }
    },
    onAddArg() {
      this.args.push({
        buffer: 'null',
        height: '80px',
      });
    },
    onDeleteArg(idx) {
      this.args.splice(idx, 1);
    },
    onArgResizeStart(idx, evt) {
      this.resizingIdx = idx;
      evt.preventDefault();
      evt.stopPropagation();
      window.dragging = true;

      let mouseY = evt.clientY;
      let originalHeight = parseInt(this.args[this.resizingIdx].height, 10);

      const handleMouseUp = evt => {
        window.removeEventListener('mouseup', handleMouseUp, true);
        window.removeEventListener('mousemove', handleMouseMove, true);
        window.dispatchEvent(new Event('resize'));
      };

      const handleMouseMove = evt => {
        let newHeight = originalHeight + evt.clientY - mouseY;
        if (newHeight > 80) {
          this.args[this.resizingIdx].height = `${newHeight}px`;
          window.dispatchEvent(new Event('resize'));
        }
      };

      window.addEventListener('mouseup', handleMouseUp, true);
      window.addEventListener('mousemove', handleMouseMove, true);
    },
    onLoadEvent(obj) {
      this.sendEventType = obj.type;
      this.args = _.cloneDeep(obj.args);
      this.provideCallback = obj.provideCallback;
    },
  }
};

</script>

<style scoped>

.event-arg-block {
  display: flex;
  align-items: stretch;
  position: relative;
}

.event-arg-block:first-child {
  border-top: 1px solid var(--vuestro-outline);
}


.event-arg-sidebar {
  font-size: 22px;
  flex-basis: 30px;
  text-align: center;
  padding-top: 2px;
  padding-bottom: 5px;
  background-color: var(--vuestro-light);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.editor-wrapper {
  flex-grow: 1;
  position: relative;
  z-index: 1;
  padding-bottom: 2px;
}

.editor-title {
  font-size: 15px;
  color: var(--vuestro-text-color-muted);
  padding: 8px;
}

.waiting-for-callback {
  padding-bottom: 5px;
  padding-left: 10px;
}

.callback-error {
  color: var(--vuestro-danger);
  margin-left: 20px;
  font-weight: 600;
}

.event-arg-block-resize-handle {
  height: 2px;
  position: absolute;
  bottom: 0;
  width: 100%;
  cursor: row-resize;
  background-color: rgba(0,0,0,0.2);
  z-index: 100;
}

</style>