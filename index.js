const express = require('express');
const socketIo = require('socket.io');
const volante = require('volante');

//
// Export a Volante module which leverages VolanteExpress to expose a
// dashboard interface into the Volante framework.
//
module.exports = {
  name: 'VolanteDashboard',
  init() {
    this.updateStats();
    // start timer to send stats to all clients
    this.timer = setInterval(() => {
      if (this.io) {
        this.updateStats();
        this.sendVolanteInfo(this.io.of('/volante-dashboard'));
      } else {
        this.$warn("no socket.io server");
      }
    }, this.statsInterval);

    // pre-fill stats array
    let now = new Date();
    for (let i=this.statsHistory; i>0; i--) {
      this.stats.push({
        ts: new Date(now - this.statsInterval*i),
        events: 0,
        cpu: 0,
        memory: 0,
        clients: [],
      });
    }

  },
  updated() {
    // register a star spoke only if enabled to forward all events client side for connected volante-dashboards
    if (this.enabled) {
      this.$hub.onAll((...args) => {
        if (!args[0].startsWith('VolanteDashboard')) { // prevent loops
          this.lastEvents++;
          this.totalEvents++;
          if (this.io) {
            this.io.of('/volante-dashboard').emit('volante.event', ...args);
          }
        }
      });
    }
  },
  done() {
    this.timer && clearInterval(this.timer);
  },
  props: {
    enabled: true,
    title: 'volante',
    version: volante.parentVersion,
    statsInterval: 5000,
    statsHistory: 60,
    user: '',
    pass: '',
    path: '/volante-dashboard',
  },
  data() {
    return {
      io: null,
      timer: null,
      lasthrtime: process.hrtime(),
      lastUsage: process.cpuUsage(),
      totalEvents: 0,
      lastEvents: 0,
      stats: [],
      logCache: [],
      socketEnabled: false,
    };
  },
  events: {
    // point VolanteExpress to the dist files for the static-built dashboard
    'VolanteExpress.pre-start'(app) {
      // but not in standalone mode
      if (this.enabled && require.main !== module) {
        app.use(this.path, (req, res, next) => {
          if (this.user.length > 0 && this.pass.length > 0) {
            if (req.headers.authorization) {
              // check authorization header
              let userpass = Buffer.from(req.headers.authorization.split('Basic ')[1], 'base64').toString();
              let [user, pass] = userpass.split(':');
              if (user === this.user && pass === this.pass) {
                return next();
              }
            }
            res.set('WWW-Authenticate', 'Basic');
            return res.status(401).send();
          }
          next();
        });
        // custom url-rewriting
        app.use(this.path, (req, res, next) => {
          //  no re-write for statis
          if (req.url.startsWith('/static')) {
            return next();
          }
          // redirect on base path to make sure there's a trailing slash
          if (req.url === '/') {
            return res.redirect(`${this.path}/index.html`);
          }
          // default re-write for trailing slash and any vue-router routes
          req.url = '//index.html';
          next();
        });
        // serve up the the static web app files
        app.use(this.path, express.static(__dirname + '/dist'));
        // endpoint to provide the configured path prop as a global var for web app
        app.get(`${this.path}/static/volante-dashboard-config.js`, (req, res) => {
          res.send(`(function() { window.basePath = '${this.path}'; })();`);
        });
        this.$log(`listening on ${this.path}`);
      }
    },
    // start socket.io when express is ready
    'VolanteExpress.listening'(obj) {
      this.startSocketIO(obj.server);
    },
    // sanity check event
    'hello.world'(...args) {
      if (typeof args[args.length -1] === 'function') {
        let callback = args.pop();
        callback(null, args);
      }
    },
  },
  methods: {
    //
    // methods starts the socket.io server and handles events to/from client side
    //
    startSocketIO(server) {
      this.$debug('starting volante-dashboard socket.io');
      this.io = socketIo(server, {
        path: `${this.path}/socket.io`,
      });
      this.socketEnabled = true;
      // let clients access io
      this.$emit('VolanteDashboard.socket.io', this.io);
      // broadcast client connections to listeners
      this.io.on('connection', (client) => {
        this.sendAppInfo(client);
        this.$emit('VolanteDashboard.socket.io.connection', client);
      });
      // use room for volante-dashboard specific socket.io traffic
      this.io.of('/volante-dashboard').on('connection', (client) => {
        this.$debug('volante-dashboard socket.io client connect');
        // always send basic info
        this.sendAppInfo(client);
        this.sendVolanteInfo(client);
        // receive events from client side to re-emit on volante
        // example:
        // Vue.socket.emit('event', {
        //   eventType: sendEventType,
        //   eventArgs: sendEventArgs,
        //   eventCallback: true,
        // });
        client.on('event', (data) => {
          this.$debug('volante-dashboard socket.io event from client', data);
          if (data.eventCallback) {
            // if eventCallback set, add a callback to the end the event args
            // for the handler to call
            data.eventArgs.push(function (err, result) {
              client.emit('callback-result', [err, result]);
            });
          }
          this.$emit(data.eventType, ...data.eventArgs);
        });
        // process events to edit volante spoke state
        client.on('spoke.update', (spokeData) => {
          this.$debug('volante-dashboard updating spoke module', spokeData);
          let spoke = this.$hub.getInstanceByName(spokeData.name);
          if (spoke) {
            let path = spokeData.key.split('.');
            let prefix = path.shift();
            // new val should be either in props. or data.
            if (prefix === 'data' || prefix === 'props') {
              var i;
              for (i = 0; i < path.length - 1; i++) {
                spoke = spoke[path[i]];
              }
              spoke[path[i]] = spokeData.val;
            }
          }
        });
        client.on('disconnect', () => {
          this.$debug('volante-dashboard socket.io client disconnect');
        });
      });
    },
    //
    // method runs on interval to calculate cpu stats and collect history on cpu
    // and connected clients
    //
    updateStats() {
      // update last values
      this.lasthrtime = process.hrtime(this.lasthrtime);
      this.lastUsage = process.cpuUsage(this.lastUsage);

      // calculate cpu
      let elapTimeMS = this.hrtimeToMS(this.lasthrtime);
      let elapUserMS = this.lastUsage.user / 1000;
      let elapSysMS = this.lastUsage.system / 1000;
      let cpuPerc = Math.round(100 * (elapUserMS + elapSysMS) / elapTimeMS);

      // gather connected client info
      let clients = [];
      if (this.io) {
        for (let v of Object.values(this.io.sockets.sockets)) {
          clients.push({
            ip: v.handshake.address,
            ua: v.handshake.headers['user-agent'],
            since: v.handshake.time,
            secure: v.handshake.secure,
          });
        }
      }

      // add to stats history
      this.stats.push({
        ts: new Date(),
        events: this.lastEvents,
        cpu: cpuPerc,
        memory: process.memoryUsage().rss,
        clients,
      });
      // slice stats to length=statsHistory
      if (this.stats.length > this.statsHistory) {
        this.stats.shift();
      }
      // reset interval event counter
      this.lastEvents = 0;
    },
    //
    // method sends info about volante-dashboard-powered app
    //
    sendAppInfo(dest) {
      if (dest && this.socketEnabled) {
        dest.emit('volante-dashboard.info', {
          title: this.title,
          version: this.version,
        });
      }
    },
    //
    // method emits info about volante wheel landscape
    //
    sendVolanteInfo(dest) {
      if (dest && this.socketEnabled) {
        let info = {
          wheel: this.$hub.getAttached(),
          uptime: this.$hub.getUptime(),
          stats: this.stats,
        };
        dest.emit('volante.info', info);
      }
    },
    //
    // helper method to convert hrtime to milliseconds
    //
    hrtimeToMS(hrtime) {
      return hrtime[0] * 1000 + hrtime[1] / 1000000;
    }
  },
};

// standalone mode
if (require.main === module) {
  console.log('running test volante wheel');
  const volante = require('volante');

  let hub = new volante.Hub().debug();

  hub.attachAll().attachFromObject(module.exports);

  hub.emit('VolanteDashboard.update', {
    path: '/',
  });

  hub.attachFromObject({
    name: 'TestSpoke',
    init() {
      setInterval(() => {
        this.counter += this.increment;
      }, 5000);
    },
    props: {
      counter: 0,
    },
    data() {
      return {
        increment: 1,
      };
    },
  });

  // set up hot-reload webpack environment for dev
  const webpack = require('webpack');
  const webpackConfig = require('./webpack.dev.config.js');
  const compiler = webpack(webpackConfig);

  hub.emit('VolanteExpress.update', {
    bind: '0.0.0.0',
    port: 3030,
    middleware: [
      (req, res, next) => {
        if (req.url === '/static/volante-dashboard-config.js') {
          return res.send('(function() { window.basePath = "/"; })();');
        }
        next();
      },
      require('connect-history-api-fallback')(),
      require('webpack-dev-middleware')(compiler, {
        publicPath: '/',
      }),
      require('webpack-hot-middleware')(compiler, {
        heartbeat: 2000
      }),
    ],
  });
  hub.emit('VolanteExpress.start');
}