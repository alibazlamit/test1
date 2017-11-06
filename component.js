define('ui/components/machine/driver-profitbricks/component',
  [
    'exports',
    'ember',
    'ember-api-store/utils/fetch',
    'ui/mixins/driver'
  ],
  function (exports, _ember, _fetch, _uiMixinsDriver) {

    const apiUrl = 'api.profitbricks.com/cloudapi/v4';

    var selLocation = 'us/las';
    var selDiskType = 'HDD';
    var selImage = 'ubuntu-16.04';
    var selDataCenter;
    var datacentersList;
    var defaultRam=4096;
    var defaultCores="2";

    const VALID_IMAGES = [
      'centOS-7',
      //'debian-7',
      'debian-8',
      //'debian-9',
      'ubuntu-17.04',
      'ubuntu-16.04',
      'ubuntu-14.04',
    ];

    const cpu_families = [{
      name: 'AMD Opteron',
      value: 'AMD_OPTERON'
    }, {
      name: 'Intel XEON',
      value: 'INTEL_XEON'
    }
    ];
    const rams = [{
      name: '1GB',
      value: 1024
    }, {
      name: '2GB',
      value: 2048
    }, {
      name: '4GB',
      value: 4096
    }, {
      name: '8GB',
      value: 8192
    }, {
      name: '16GB',
      value: 16384
    }, {
      name: '32GB',
      value: 32768
    }, {
      name: '64GB',
      value: 65536
    }

    ];
    const cores = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const disk_types = ['SSD', 'HDD'];

    exports['default'] = _ember['default'].Component.extend(_uiMixinsDriver['default'], {
      driverName: 'profitbricks',
      model: null,
      'profitbricksConfig': Ember.computed.alias('model.profitbricksConfig'),
      locations: null,
      location: selLocation,
      datacenters: null,
      datacenterName: null,
      datacenterId: null,
      image: null,
      imageId: null,
      cpu_families: cpu_families,
      rams: rams,
      cores: cores,
      disk_types: disk_types,
      images: null,
      //View properties
      step1: true,
      step2: false,
      step3: false,
      dcCreated: false,
      gettingData: false,
      creatingDC: false,
      imageLoading: true,
      waitData: false,
      canAuthenticate: Ember.computed.and('model.profitbricksConfig.username', 'model.profitbricksConfig.password'),

      bootstrap() {
      let config = this.get('store').createRecord({
        type: 'profitbricksConfig'
      });
      let type = 'host';
      if (!this.get('useHost')) {
        type = 'machine';
      }

      this.set('model', this.get('store').createRecord({
        type: type,
        'profitbricksConfig': config
      }));
      this.set('editing', false);
      //setting default values
      this.set('model.profitbricksConfig.ram', defaultRam);
      this.set('model.profitbricksConfig.cores', defaultCores);

    },
    validate() {
      this._super();

      let errors = this.get('errors') || [],
        model = this.get('model.profitbricksConfig'),
        error_keys = {
          cores: '"Cores" is required',
          cpuFamily: '"CPU family" is required',
          diskSize: '"Volume size" is required',
          diskType: '"Disk type" is required',
          image: '"Image" is required',
          location: '"Location" is required',
          ram: '"RAM" is required',
          name: '"Name" is required'
        },
        valid = true;

      Object.keys(error_keys).forEach((error_key) => {
        if (model[error_key] == null || model[error_key] === '') {
        errors.push(error_keys[error_key])
        valid = false;
      }
    });

      if (!valid)
        this.set('errors', errors);
      return valid;
    },
    willDestroyElement() {
      this.set('errors', null);
    },
    apiRequest(command, opt, out) {
      opt = opt || {};

      let url = this.get('app.proxyEndpoint') + '/';
      if (opt.url) {
        url += opt.url.replace(/^http[s]?\/\//, '');
      } else {
        url += `${apiUrl}/${command}`;
      }

      var auth = 'Basic ' + btoa(this.get('model.profitbricksConfig.username') + ':' + this.get('model.profitbricksConfig.password'));
      return _fetch.fetch(url + "?depth=5", {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': '*',
            'Content-Language': 'en-US',
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-api-auth-header': auth
          },
        }).then((res) => {
          let body = res.body;
      if (out) {
        out[command].pushObjects(body[command]);
      } else {
        out = body;
      }
      return out;
    });
    },
    apiPOSTRequest(command, opt, out) {
      opt = opt || {};

      let url = this.get('app.proxyEndpoint') + '/';
      if (opt.url) {
        url += opt.url.replace(/^http[s]?\/\//, '');
      } else {
        url += `${apiUrl}/${command}`;
      }

      var auth = 'Basic ' + btoa(this.get('model.profitbricksConfig.username') + ':' + this.get('model.profitbricksConfig.password'));
      var body = {
        "properties": {
          "name": this.get('model.profitbricksConfig.datacenterName'),
          "description": this.get('model.profitbricksConfig.datacenterName'),
          "location": selLocation
        }
      }
      return _fetch.fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            'Accept': 'application/json',
            'Accept-Language': '*',
            'Content-Language': 'en-US',
            'Content-Type': 'application/json',
            'x-api-auth-header': auth
          },
        }).then((res) => {
          let body = res.body;
      if (out) {
        out[command].pushObjects(body[command]);
      } else {
        out = body;
      }
      return out;
    });
    },
    getImages() {
      let promises = {
        images: this.apiRequest('images')
      };
      this.set('imageLoading', true);
      Ember.RSVP.hash(promises).then((hash) => {
        let filteredImages = hash.images.items.filter(function (image) {
          // Match location
          var locationMatch = ((image.properties.location || '') && image.properties.location === selLocation);
          var imageApplicable = false;
          var matchDiskType = image.properties.imageType === 'HDD';
          var isPublic=image.properties.public;
          for (var i = 0; i < VALID_IMAGES.length; i++) {
            if (image.properties.name.toLowerCase().includes(VALID_IMAGES[i].toLowerCase())) {
              imageApplicable = true;
              break;
            }
          }
          return locationMatch && imageApplicable && matchDiskType && isPublic;
        }).map(function (image) {
          return image;
        });

      for(var i=0; i < filteredImages.length; i++){
        if (filteredImages[i].properties.name.toLowerCase().includes(selImage.toLowerCase())) {
          if (filteredImages[i].properties.imageAliases.length > 0) {
            this.set('model.profitbricksConfig.image', filteredImages[i].properties.imageAliases[0]);
          }
          this.set('model.profitbricksConfig.imageId', filteredImages[i].id);
          this.getImage(filteredImages[i].id);
        }
      }
      this.setProperties({
        images: filteredImages
      });

    }, (err) => {
        let errors = this.get('errors') || [];
        errors.push(`${err.statusText}`);
        this.setProperties({
          errors: errors,
        });
      });
    },
    getDatacenter(dcId) {
      for(var i=0;i<datacentersList.length;i++){
        if(datacentersList[i].id==dcId)
          return datacentersList[i];
      }
    },
    getImage(curImage) {
      let promises = {
        curImage: this.apiRequest('images/' + curImage)
      };
      Ember.RSVP.hash(promises).then((hash) => {
        if (hash.curImage.properties.imageAliases.length > 0) {
        this.set('model.profitbricksConfig.image', hash.curImage.properties.imageAliases[0]);
        this.setProperties({
          waitData: false,
          imageLoading: false,
        });
      }
    }, (err) => {
        let errors = this.get('errors') || [];
        errors.push(`${err.statusText}`);
        this.setProperties({
          errors: errors,
          imageLoading: false,
        });
      });
    },
    actions: {

      createDatacenter() {
        let promises = {
          datacenter: this.apiPOSTRequest('datacenters')
        };
        this.set('creatingDC', true);
        Ember.RSVP.hash(promises).then((hash) => {
          this.set('model.profitbricksConfig.datacenterId', hash.datacenter.id);
        selDataCenter = hash.datacenter;
        this.setProperties({
          dcCreated: true,
          creatingDC: false,
        });
      }, (err) => {
          let errors = this.get('errors') || [];
          errors.push(`${err.statusText}: Create datacenter failed`);
          this.setProperties({
            errors: errors,
            creatingDC: false,
          });
        });
      },
      toLastStep() {
        selLocation=selDataCenter.properties.location;
        this.set('model.profitbricksConfig.location', selDataCenter.properties.location);

        this.setProperties({
          step1: false,
          step2: false,
          step3: true,
          errors: null
        });
      },
      getLocations() {
        let promises = {
          locations: this.apiRequest('locations'),
          datacenters: this.apiRequest('datacenters')
        };
        this.set('gettingData', true);
        Ember.RSVP.hash(promises).then((hash) => {
          datacentersList=hash.datacenters.items;
        this.setProperties({
          locations: hash.locations.items,
          datacenters: hash.datacenters.items,
          step1: false,
          step2: true,
          errors: null

        });
        if (hash.datacenters.items.length > 0) {
          this.set('model.profitbricksConfig.datacenterId', hash.datacenters.items[0].id);
          this.set('model.profitbricksConfig.location', hash.datacenters.items[0].properties.location);
          selLocation=hash.datacenters.items[0].properties.location;
          selDataCenter = hash.datacenters.items[0];
        }
      }, (err) => {
          let errors = this.get('errors') || [];
          errors.push(`${err.statusText}: Incorrect Username or Password`);
          this.setProperties({
            errors: errors,
            gettingData: false,
          });
        });
        this.getImages(selLocation)

      },
      selectImage(img) {
        this.setProperties({
          waitData: true,
        });
        this.getImage(img);
      },
      selectLocation(loc) {
        this.set('model.profitbricksConfig.location', loc);
        selLocation = loc;
        this.getImages()
      },
      selectDataCenter(dc) {
        this.set('model.profitbricksConfig.datacenterId', dc);
        selDataCenter = this.getDatacenter(dc);
      },
      selectCpuFamily(cpu_family) {
        this.set('model.profitbricksConfig.cpuFamily', cpu_family);
      },
      selectCores(cores) {
        this.set('model.profitbricksConfig.cores', cores)
      },
      selectRam(ram) {
        this.set('model.profitbricksConfig.ram', ram);
      },
      selectDiskType(type) {
        selDiskType = type;
        this.set('model.profitbricksConfig.diskType', type);
      },
      create() {
        // console.log(this.get('model.profitbricksConfig'));
      },
      cancel() {
        this.setProperties({
          step1: false,
          step2: true,
          step3: false,
          errors: null
        });

      }
    },

    init() {
      this._super(...arguments);

      console.log('called init()');
    }
  });
  });
;
define("ui/components/machine/driver-profitbricks/template",["exports","ember","ui/mixins/driver"],function(exports,_ember,_uiMixinsDriver){

exports["default"] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.9.1",
          "loc": {
            "source": null,
            "start": {
              "line": 32,
              "column": 12
            },
            "end": {
              "line": 34,
              "column": 12
            }
          }
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1,"class","btn bg-primary btn-disabled");
          var el2 = dom.createElement("i");
          dom.setAttribute(el2,"class","icon icon-spinner icon-spin");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode(" ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),2,2);
          return morphs;
        },
        statements: [
          ["inline","t",["generic.loading"],[],["loc",[null,[33,104],[33,127]]],0,0]
        ],
        locals: [],
        templates: []
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.9.1",
          "loc": {
            "source": null,
            "start": {
              "line": 34,
              "column": 12
            },
            "end": {
              "line": 36,
              "column": 12
            }
          }
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("                ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          dom.setAttribute(el1,"class","btn bg-primary");
          var el2 = dom.createTextNode("Authenticate");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element21 = dom.childAt(fragment, [1]);
          var morphs = new Array(2);
          morphs[0] = dom.createAttrMorph(element21, 'disabled');
          morphs[1] = dom.createElementMorph(element21);
          return morphs;
        },
        statements: [
          ["attribute","disabled",["subexpr","not",[["get","canAuthenticate",["loc",[null,[35,100],[35,115]]],0,0,0,0]],[],["loc",[null,[null,null],[35,117]]],0,0],0,0,0,0],
          ["element","action",["getLocations","locations"],[],["loc",[null,[35,24],[35,61]]],0,0]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 2,
            "column": 2
          },
          "end": {
            "line": 40,
            "column": 2
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("      ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("form");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("          ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","over-hr r-mb20");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        var el4 = dom.createTextNode("\n            ProfitBricks Authentication\n            ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n          ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n          ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row form-group");
        var el3 = dom.createTextNode("\n              ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-2 form-label");
        var el4 = dom.createTextNode("\n                  ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        dom.setAttribute(el4,"class","form-control-static");
        var el5 = dom.createTextNode("\n                      Username\n                  ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n              ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-4");
        var el4 = dom.createTextNode("\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n          ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n          ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row form-group");
        var el3 = dom.createTextNode("\n              ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-2 form-label");
        var el4 = dom.createTextNode("\n                  ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("label");
        dom.setAttribute(el4,"class","form-control-static");
        var el5 = dom.createTextNode("\n                      Passsword\n                  ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n              ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-4");
        var el4 = dom.createTextNode("\n                ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n          ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n        ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n          ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","footer-actions");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("              ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3,"class","btn bg-transparent");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n          ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element22 = dom.childAt(fragment, [1]);
        var element23 = dom.childAt(element22, [10]);
        var element24 = dom.childAt(element23, [3]);
        var morphs = new Array(6);
        morphs[0] = dom.createMorphAt(dom.childAt(element22, [4, 3]),1,1);
        morphs[1] = dom.createMorphAt(dom.childAt(element22, [6, 3]),1,1);
        morphs[2] = dom.createMorphAt(element22,8,8);
        morphs[3] = dom.createMorphAt(element23,1,1);
        morphs[4] = dom.createElementMorph(element24);
        morphs[5] = dom.createMorphAt(element24,0,0);
        return morphs;
      },
      statements: [
        ["inline","input",[],["type","text","name","username","classNames","form-control","placeholder","Your ProfitBricks username","value",["subexpr","@mut",[["get","model.profitbricksConfig.username",["loc",[null,[17,125],[17,158]]],0,0,0,0]],[],[],0,0]],["loc",[null,[17,16],[17,160]]],0,0],
        ["inline","input",[],["type","password","name","password","classNames","form-control","placeholder","Your ProfitBricks password","value",["subexpr","@mut",[["get","model.profitbricksConfig.password",["loc",[null,[27,129],[27,162]]],0,0,0,0]],[],[],0,0]],["loc",[null,[27,16],[27,164]]],0,0],
        ["inline","top-errors",[],["errors",["subexpr","@mut",[["get","errors",["loc",[null,[30,28],[30,34]]],0,0,0,0]],[],[],0,0]],["loc",[null,[30,8],[30,36]]],0,0],
        ["block","if",[["get","gettingData",["loc",[null,[32,18],[32,29]]],0,0,0,0]],[],0,1,["loc",[null,[32,12],[36,19]]]],
        ["element","action",["cancel"],[],["loc",[null,[37,22],[37,41]]],0,0],
        ["inline","t",["generic.cancel"],[],["loc",[null,[37,69],[37,91]]],0,0]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }());
  var child1 = (function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 58,
                "column": 20
              },
              "end": {
                "line": 63,
                "column": 20
              }
            }
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                        ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("option");
            var el2 = dom.createTextNode("\n                          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                        ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element17 = dom.childAt(fragment, [1]);
            var morphs = new Array(3);
            morphs[0] = dom.createAttrMorph(element17, 'value');
            morphs[1] = dom.createAttrMorph(element17, 'selected');
            morphs[2] = dom.createMorphAt(element17,1,1);
            return morphs;
          },
          statements: [
            ["attribute","value",["concat",[["get","datacenter.id",["loc",[null,[59,41],[59,54]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
            ["attribute","selected",["subexpr","eq",[["get","datacenter.id",["loc",[null,[60,46],[60,59]]],0,0,0,0],["get","model.profitbricksConfig.datacenterId",["loc",[null,[60,60],[60,97]]],0,0,0,0]],[],["loc",[null,[null,null],[60,99]]],0,0],0,0,0,0],
            ["content","datacenter.properties.name",["loc",[null,[61,26],[61,56]]],0,0,0,0]
          ],
          locals: ["datacenter"],
          templates: []
        };
      }());
      var child1 = (function() {
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 91,
                "column": 16
              },
              "end": {
                "line": 96,
                "column": 16
              }
            }
          },
          isEmpty: false,
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("option");
            var el2 = dom.createTextNode("\n                      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element16 = dom.childAt(fragment, [1]);
            var morphs = new Array(3);
            morphs[0] = dom.createAttrMorph(element16, 'value');
            morphs[1] = dom.createAttrMorph(element16, 'selected');
            morphs[2] = dom.createMorphAt(element16,1,1);
            return morphs;
          },
          statements: [
            ["attribute","value",["concat",[["get","location.id",["loc",[null,[92,37],[92,48]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
            ["attribute","selected",["subexpr","eq",[["get","location.id",["loc",[null,[93,42],[93,53]]],0,0,0,0],["get","model.profitbricksConfig.location",["loc",[null,[93,54],[93,87]]],0,0,0,0]],[],["loc",[null,[null,null],[93,89]]],0,0],0,0,0,0],
            ["content","location.id",["loc",[null,[94,22],[94,37]]],0,0,0,0]
          ],
          locals: ["location"],
          templates: []
        };
      }());
      var child2 = (function() {
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 100,
                "column": 12
              },
              "end": {
                "line": 102,
                "column": 12
              }
            }
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("i");
            dom.setAttribute(el1,"class","icon icon-spinner icon-spin");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode(" ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment,3,3,contextualElement);
            return morphs;
          },
          statements: [
            ["inline","t",["generic.loading"],[],["loc",[null,[101,60],[101,83]]],0,0]
          ],
          locals: [],
          templates: []
        };
      }());
      var child3 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 102,
                  "column": 12
                },
                "end": {
                  "line": 104,
                  "column": 12
                }
              }
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                Datacenter created successfuly\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes() { return []; },
            statements: [

            ],
            locals: [],
            templates: []
          };
        }());
        var child1 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 104,
                  "column": 12
                },
                "end": {
                  "line": 106,
                  "column": 12
                }
              }
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("button");
              dom.setAttribute(el1,"class","btn bg-primary");
              var el2 = dom.createTextNode("Create Data Center");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n            ");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element15 = dom.childAt(fragment, [1]);
              var morphs = new Array(2);
              morphs[0] = dom.createAttrMorph(element15, 'disabled');
              morphs[1] = dom.createElementMorph(element15);
              return morphs;
            },
            statements: [
              ["attribute","disabled",["subexpr","not",[["get","model.profitbricksConfig.datacenterName",["loc",[null,[105,39],[105,78]]],0,0,0,0]],[],["loc",[null,[null,null],[105,80]]],0,0],0,0,0,0],
              ["element","action",["createDatacenter"],[],["loc",[null,[105,81],[105,110]]],0,0]
            ],
            locals: [],
            templates: []
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 102,
                "column": 12
              },
              "end": {
                "line": 106,
                "column": 12
              }
            }
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [
            ["block","if",[["get","dcCreated",["loc",[null,[102,22],[102,31]]],0,0,0,0]],[],0,1,["loc",[null,[102,12],[106,12]]]]
          ],
          locals: [],
          templates: [child0, child1]
        };
      }());
      var child4 = (function() {
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 111,
                "column": 8
              },
              "end": {
                "line": 115,
                "column": 8
              }
            }
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("            ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","col-md-2 col-md-offset-5");
            var el2 = dom.createTextNode("\n                ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("i");
            dom.setAttribute(el2,"class","icon icon-spinner icon-spin");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode(" ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n            ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),3,3);
            return morphs;
          },
          statements: [
            ["inline","t",["generic.loading"],[],["loc",[null,[113,60],[113,83]]],0,0]
          ],
          locals: [],
          templates: []
        };
      }());
      var child5 = (function() {
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 115,
                "column": 8
              },
              "end": {
                "line": 119,
                "column": 8
              }
            }
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("            ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","col-md-2 col-md-offset-5");
            var el2 = dom.createTextNode("\n                ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("button");
            dom.setAttribute(el2,"class","btn bg-primary");
            var el3 = dom.createTextNode("Continue to Node configuration");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n            ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element14 = dom.childAt(fragment, [1, 1]);
            var morphs = new Array(2);
            morphs[0] = dom.createAttrMorph(element14, 'disabled');
            morphs[1] = dom.createElementMorph(element14);
            return morphs;
          },
          statements: [
            ["attribute","disabled",["subexpr","not",[["get","model.profitbricksConfig.datacenterId",["loc",[null,[117,63],[117,100]]],0,0,0,0]],[],["loc",[null,[null,null],[117,102]]],0,0],0,0,0,0],
            ["element","action",["toLastStep"],[],["loc",[null,[117,24],[117,47]]],0,0]
          ],
          locals: [],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.9.1",
          "loc": {
            "source": null,
            "start": {
              "line": 40,
              "column": 2
            },
            "end": {
              "line": 121,
              "column": 2
            }
          }
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","row");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","over-hr r-mb20");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          var el3 = dom.createTextNode("\n        You can choose an available Data Center from the list\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","row form-group");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","row form-group");
          var el3 = dom.createTextNode("\n              ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","col-md-2 form-label");
          var el4 = dom.createTextNode("\n                  ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("label");
          dom.setAttribute(el4,"class","form-control-static");
          var el5 = dom.createTextNode("\n                      Available Data Centers\n                  ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n              ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n              ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","col-md-3");
          var el4 = dom.createTextNode("\n                  ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("select");
          dom.setAttribute(el4,"class","form-control");
          var el5 = dom.createTextNode("\n");
          dom.appendChild(el4, el5);
          var el5 = dom.createComment("");
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("                  ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n              ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","over-hr r-mb20");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          var el3 = dom.createTextNode("\n            Or Create one by entering the Name with the desired location\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","row form-group");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-md-2 form-label");
          var el3 = dom.createTextNode("\n              ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("label");
          dom.setAttribute(el3,"class","form-control-static");
          var el4 = dom.createTextNode("\n                  Data Center\n              ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-md-3");
          var el3 = dom.createTextNode("\n            ");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","row form-group");
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-md-2 form-label");
          var el3 = dom.createTextNode("\n              ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("label");
          dom.setAttribute(el3,"class","form-control-static");
          var el4 = dom.createTextNode("\n                  Location\n              ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-md-3");
          var el3 = dom.createTextNode("\n              ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("select");
          dom.setAttribute(el3,"class","form-control");
          var el4 = dom.createTextNode("\n");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("              ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-md-2");
          var el3 = dom.createTextNode("\n");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("          ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("hr");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","row form-group");
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element18 = dom.childAt(fragment, [5, 1, 3, 1]);
          var element19 = dom.childAt(fragment, [11]);
          var element20 = dom.childAt(element19, [3, 1]);
          var morphs = new Array(9);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),1,1);
          morphs[1] = dom.createAttrMorph(element18, 'onchange');
          morphs[2] = dom.createAttrMorph(element18, 'disabled');
          morphs[3] = dom.createMorphAt(element18,1,1);
          morphs[4] = dom.createMorphAt(dom.childAt(fragment, [9, 3]),1,1);
          morphs[5] = dom.createAttrMorph(element20, 'onchange');
          morphs[6] = dom.createMorphAt(element20,1,1);
          morphs[7] = dom.createMorphAt(dom.childAt(element19, [5]),1,1);
          morphs[8] = dom.createMorphAt(dom.childAt(fragment, [15]),1,1);
          return morphs;
        },
        statements: [
          ["inline","top-errors",[],["errors",["subexpr","@mut",[["get","errors",["loc",[null,[42,28],[42,34]]],0,0,0,0]],[],[],0,0]],["loc",[null,[42,8],[42,36]]],0,0],
          ["attribute","onchange",["subexpr","action",["selectDataCenter"],["value","target.value"],["loc",[null,[null,null],[57,106]]],0,0],0,0,0,0],
          ["attribute","disabled",["get","model.profitbricksConfig.datacenterName",["loc",[null,[57,118],[57,157]]],0,0,0,0],0,0,0,0],
          ["block","each",[["get","datacenters",["loc",[null,[58,28],[58,39]]],0,0,0,0]],[],0,null,["loc",[null,[58,20],[63,29]]]],
          ["inline","input",[],["type","text","disabled",["subexpr","@mut",[["get","dcCreated",["loc",[null,[80,41],[80,50]]],0,0,0,0]],[],[],0,0],"name","datacenterId","classNames","form-control","placeholder","Data Center Name","value",["subexpr","@mut",[["get","model.profitbricksConfig.datacenterName",["loc",[null,[80,134],[80,173]]],0,0,0,0]],[],[],0,0]],["loc",[null,[80,12],[80,175]]],0,0],
          ["attribute","onchange",["subexpr","action",["selectLocation"],["value","target.value"],["loc",[null,[null,null],[90,100]]],0,0],0,0,0,0],
          ["block","each",[["get","locations",["loc",[null,[91,24],[91,33]]],0,0,0,0]],[],1,null,["loc",[null,[91,16],[96,25]]]],
          ["block","if",[["get","creatingDC",["loc",[null,[100,18],[100,28]]],0,0,0,0]],[],2,3,["loc",[null,[100,12],[106,19]]]],
          ["block","if",[["get","creatingDC",["loc",[null,[111,14],[111,24]]],0,0,0,0]],[],4,5,["loc",[null,[111,8],[119,15]]]]
        ],
        locals: [],
        templates: [child0, child1, child2, child3, child4, child5]
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 142,
                  "column": 16
                },
                "end": {
                  "line": 147,
                  "column": 16
                }
              }
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                    ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("option");
              var el2 = dom.createTextNode("\n                      ");
              dom.appendChild(el1, el2);
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("\n                    ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element5 = dom.childAt(fragment, [1]);
              var morphs = new Array(3);
              morphs[0] = dom.createAttrMorph(element5, 'value');
              morphs[1] = dom.createAttrMorph(element5, 'selected');
              morphs[2] = dom.createMorphAt(element5,1,1);
              return morphs;
            },
            statements: [
              ["attribute","value",["concat",[["get","cpu_family.value",["loc",[null,[143,37],[143,53]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
              ["attribute","selected",["subexpr","eq",[["get","cpu_family.value",["loc",[null,[144,42],[144,58]]],0,0,0,0],["get","model.profitbricksConfig.value",["loc",[null,[144,59],[144,89]]],0,0,0,0]],[],["loc",[null,[null,null],[144,91]]],0,0],0,0,0,0],
              ["content","cpu_family.name",["loc",[null,[145,22],[145,41]]],0,0,0,0]
            ],
            locals: ["cpu_family"],
            templates: []
          };
        }());
        var child1 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 157,
                  "column": 16
                },
                "end": {
                  "line": 161,
                  "column": 16
                }
              }
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                    ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("option");
              var el2 = dom.createTextNode("\n                      ");
              dom.appendChild(el1, el2);
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("\n                    ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element4 = dom.childAt(fragment, [1]);
              var morphs = new Array(3);
              morphs[0] = dom.createAttrMorph(element4, 'value');
              morphs[1] = dom.createAttrMorph(element4, 'selected');
              morphs[2] = dom.createMorphAt(element4,1,1);
              return morphs;
            },
            statements: [
              ["attribute","value",["concat",[["get","core",["loc",[null,[158,37],[158,41]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
              ["attribute","selected",["subexpr","eq",[["get","core",["loc",[null,[158,59],[158,63]]],0,0,0,0],["get","model.profitbricksConfig.cores",["loc",[null,[158,64],[158,94]]],0,0,0,0]],[],["loc",[null,[null,null],[158,96]]],0,0],0,0,0,0],
              ["content","core",["loc",[null,[159,22],[159,30]]],0,0,0,0]
            ],
            locals: ["core"],
            templates: []
          };
        }());
        var child2 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 174,
                  "column": 16
                },
                "end": {
                  "line": 178,
                  "column": 16
                }
              }
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                    ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("option");
              var el2 = dom.createTextNode("\n                      ");
              dom.appendChild(el1, el2);
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("\n                    ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element3 = dom.childAt(fragment, [1]);
              var morphs = new Array(3);
              morphs[0] = dom.createAttrMorph(element3, 'value');
              morphs[1] = dom.createAttrMorph(element3, 'selected');
              morphs[2] = dom.createMorphAt(element3,1,1);
              return morphs;
            },
            statements: [
              ["attribute","value",["concat",[["get","ram.value",["loc",[null,[175,37],[175,46]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
              ["attribute","selected",["subexpr","eq",[["get","ram.value",["loc",[null,[175,64],[175,73]]],0,0,0,0],["get","model.profitbricksConfig.ram",["loc",[null,[175,74],[175,102]]],0,0,0,0]],[],["loc",[null,[null,null],[175,104]]],0,0],0,0,0,0],
              ["content","ram.name",["loc",[null,[176,22],[176,34]]],0,0,0,0]
            ],
            locals: ["ram"],
            templates: []
          };
        }());
        var child3 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 188,
                  "column": 16
                },
                "end": {
                  "line": 192,
                  "column": 16
                }
              }
            },
            isEmpty: false,
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                    ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("option");
              var el2 = dom.createTextNode("\n                      ");
              dom.appendChild(el1, el2);
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("\n                    ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element2 = dom.childAt(fragment, [1]);
              var morphs = new Array(3);
              morphs[0] = dom.createAttrMorph(element2, 'value');
              morphs[1] = dom.createAttrMorph(element2, 'selected');
              morphs[2] = dom.createMorphAt(element2,1,1);
              return morphs;
            },
            statements: [
              ["attribute","value",["concat",[["get","disk_type",["loc",[null,[189,37],[189,46]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
              ["attribute","selected",["subexpr","eq",[["get","disk_type",["loc",[null,[189,64],[189,73]]],0,0,0,0],["get","model.profitbricksConfig.diskType",["loc",[null,[189,74],[189,107]]],0,0,0,0]],[],["loc",[null,[null,null],[189,109]]],0,0],0,0,0,0],
              ["content","disk_type",["loc",[null,[190,22],[190,35]]],0,0,0,0]
            ],
            locals: ["disk_type"],
            templates: []
          };
        }());
        var child4 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 204,
                  "column": 12
                },
                "end": {
                  "line": 206,
                  "column": 12
                }
              }
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("i");
              dom.setAttribute(el1,"class","icon icon-spinner icon-spin");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode(" ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,3,3,contextualElement);
              return morphs;
            },
            statements: [
              ["inline","t",["generic.loading"],[],["loc",[null,[205,60],[205,83]]],0,0]
            ],
            locals: [],
            templates: []
          };
        }());
        var child5 = (function() {
          var child0 = (function() {
            return {
              meta: {
                "revision": "Ember@2.9.1",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 208,
                    "column": 18
                  },
                  "end": {
                    "line": 213,
                    "column": 18
                  }
                }
              },
              isEmpty: false,
              arity: 1,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("                      ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("option");
                var el2 = dom.createTextNode("\n                        ");
                dom.appendChild(el1, el2);
                var el2 = dom.createComment("");
                dom.appendChild(el1, el2);
                var el2 = dom.createTextNode("\n                      ");
                dom.appendChild(el1, el2);
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
                var element0 = dom.childAt(fragment, [1]);
                var morphs = new Array(3);
                morphs[0] = dom.createAttrMorph(element0, 'value');
                morphs[1] = dom.createAttrMorph(element0, 'selected');
                morphs[2] = dom.createMorphAt(element0,1,1);
                return morphs;
              },
              statements: [
                ["attribute","value",["concat",[["get","image.id",["loc",[null,[209,39],[209,47]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
                ["attribute","selected",["subexpr","eq",[["get","image.id",["loc",[null,[210,44],[210,52]]],0,0,0,0],["get","model.profitbricksConfig.imageId",["loc",[null,[210,53],[210,85]]],0,0,0,0]],[],["loc",[null,[null,null],[210,87]]],0,0],0,0,0,0],
                ["content","image.properties.name",["loc",[null,[211,24],[211,49]]],0,0,0,0]
              ],
              locals: ["image"],
              templates: []
            };
          }());
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 206,
                  "column": 12
                },
                "end": {
                  "line": 215,
                  "column": 12
                }
              }
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("select");
              dom.setAttribute(el1,"class","form-control");
              var el2 = dom.createTextNode("\n");
              dom.appendChild(el1, el2);
              var el2 = dom.createComment("");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("                ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element1 = dom.childAt(fragment, [1]);
              var morphs = new Array(2);
              morphs[0] = dom.createAttrMorph(element1, 'onchange');
              morphs[1] = dom.createMorphAt(element1,1,1);
              return morphs;
            },
            statements: [
              ["attribute","onchange",["subexpr","action",["selectImage"],["value","target.value"],["loc",[null,[null,null],[207,99]]],0,0],0,0,0,0],
              ["block","each",[["get","images",["loc",[null,[208,26],[208,32]]],0,0,0,0]],[],0,null,["loc",[null,[208,18],[213,27]]]]
            ],
            locals: [],
            templates: [child0]
          };
        }());
        var child6 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 235,
                  "column": 8
                },
                "end": {
                  "line": 237,
                  "column": 8
                }
              }
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("            ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("i");
              dom.setAttribute(el1,"class","icon icon-spinner icon-spin");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode(" ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,3,3,contextualElement);
              return morphs;
            },
            statements: [
              ["inline","t",["generic.loading"],[],["loc",[null,[236,56],[236,79]]],0,0]
            ],
            locals: [],
            templates: []
          };
        }());
        var child7 = (function() {
          return {
            meta: {
              "revision": "Ember@2.9.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 237,
                  "column": 8
                },
                "end": {
                  "line": 239,
                  "column": 8
                }
              }
            },
            isEmpty: false,
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("          ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
              return morphs;
            },
            statements: [
              ["inline","save-cancel",[],["save","save","cancel","cancel"],["loc",[null,[238,10],[238,53]]],0,0]
            ],
            locals: [],
            templates: []
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.9.1",
            "loc": {
              "source": null,
              "start": {
                "line": 121,
                "column": 2
              },
              "end": {
                "line": 241,
                "column": 2
              }
            }
          },
          isEmpty: false,
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","box mt-20");
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","row");
            var el3 = dom.createTextNode("\n            ");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","over-hr r-mb20");
            var el2 = dom.createTextNode("\n        ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("span");
            var el3 = dom.createTextNode("\n            Instance configuration\n        ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","row form-group");
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-2 form-label");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","form-control-static");
            var el4 = dom.createTextNode("\n                  CPU family\n              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-4");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("select");
            dom.setAttribute(el3,"class","form-control");
            var el4 = dom.createTextNode("\n");
            dom.appendChild(el3, el4);
            var el4 = dom.createComment("");
            dom.appendChild(el3, el4);
            var el4 = dom.createTextNode("              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-2 form-label");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","form-control-static");
            var el4 = dom.createTextNode("\n                  Cores\n              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-4");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("select");
            dom.setAttribute(el3,"class","form-control");
            var el4 = dom.createTextNode("\n");
            dom.appendChild(el3, el4);
            var el4 = dom.createComment("");
            dom.appendChild(el3, el4);
            var el4 = dom.createTextNode("              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","row form-group");
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-2 form-label");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","form-control-static");
            var el4 = dom.createTextNode("\n                  RAM\n              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-4");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("select");
            dom.setAttribute(el3,"class","form-control");
            var el4 = dom.createTextNode("\n");
            dom.appendChild(el3, el4);
            var el4 = dom.createComment("");
            dom.appendChild(el3, el4);
            var el4 = dom.createTextNode("              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-2 form-label");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","form-control-static");
            var el4 = dom.createTextNode("\n                  Disk type\n              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-4");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("select");
            dom.setAttribute(el3,"class","form-control");
            var el4 = dom.createTextNode("\n");
            dom.appendChild(el3, el4);
            var el4 = dom.createComment("");
            dom.appendChild(el3, el4);
            var el4 = dom.createTextNode("              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","row form-group");
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-2 form-label");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","form-control-static");
            var el4 = dom.createTextNode("\n                  Image\n              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-4");
            var el3 = dom.createTextNode("\n");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("span");
            dom.setAttribute(el3,"class","help-block");
            var el4 = dom.createTextNode("\n                ");
            dom.appendChild(el3, el4);
            var el4 = dom.createElement("strong");
            var el5 = dom.createTextNode("Note:");
            dom.appendChild(el4, el5);
            dom.appendChild(el3, el4);
            var el4 = dom.createTextNode(" Ubuntu 16.04 requires Docker v1.12 or greater. You will need to change the Docker Install URL under the Advanced Options tab.\n            ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-2 form-label");
            var el3 = dom.createTextNode("\n              ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","form-control-static");
            var el4 = dom.createTextNode("\n                  Volume size (GB)\n              ");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","col-md-4");
            var el3 = dom.createTextNode("\n            ");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","footer-actions");
            var el2 = dom.createTextNode("\n          ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","row");
            var el3 = dom.createTextNode("\n            ");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n  ");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element6 = dom.childAt(fragment, [7]);
            var element7 = dom.childAt(element6, [3, 1]);
            var element8 = dom.childAt(element6, [7, 1]);
            var element9 = dom.childAt(fragment, [10]);
            var element10 = dom.childAt(element9, [3, 1]);
            var element11 = dom.childAt(element9, [7, 1]);
            var element12 = dom.childAt(fragment, [13]);
            var element13 = dom.childAt(fragment, [18]);
            var morphs = new Array(14);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1, 1]),1,1);
            morphs[1] = dom.createAttrMorph(element7, 'onchange');
            morphs[2] = dom.createMorphAt(element7,1,1);
            morphs[3] = dom.createAttrMorph(element8, 'onchange');
            morphs[4] = dom.createMorphAt(element8,1,1);
            morphs[5] = dom.createAttrMorph(element10, 'onchange');
            morphs[6] = dom.createMorphAt(element10,1,1);
            morphs[7] = dom.createAttrMorph(element11, 'onchange');
            morphs[8] = dom.createMorphAt(element11,1,1);
            morphs[9] = dom.createMorphAt(dom.childAt(element12, [3]),1,1);
            morphs[10] = dom.createMorphAt(dom.childAt(element12, [7]),1,1);
            morphs[11] = dom.createMorphAt(fragment,15,15,contextualElement);
            morphs[12] = dom.createMorphAt(dom.childAt(element13, [1]),1,1);
            morphs[13] = dom.createMorphAt(element13,3,3);
            return morphs;
          },
          statements: [
            ["inline","partial",["host/add-common"],[],["loc",[null,[124,12],[124,41]]],0,0],
            ["attribute","onchange",["subexpr","action",["selectCpuFamily"],["value","target.value"],["loc",[null,[null,null],[141,101]]],0,0],0,0,0,0],
            ["block","each",[["get","cpu_families",["loc",[null,[142,24],[142,36]]],0,0,0,0]],[],0,null,["loc",[null,[142,16],[147,25]]]],
            ["attribute","onchange",["subexpr","action",["selectCores"],["value","target.value"],["loc",[null,[null,null],[156,97]]],0,0],0,0,0,0],
            ["block","each",[["get","cores",["loc",[null,[157,24],[157,29]]],0,0,0,0]],[],1,null,["loc",[null,[157,16],[161,25]]]],
            ["attribute","onchange",["subexpr","action",["selectRam"],["value","target.value"],["loc",[null,[null,null],[173,95]]],0,0],0,0,0,0],
            ["block","each",[["get","rams",["loc",[null,[174,24],[174,28]]],0,0,0,0]],[],2,null,["loc",[null,[174,16],[178,25]]]],
            ["attribute","onchange",["subexpr","action",["selectDiskType"],["value","target.value"],["loc",[null,[null,null],[187,100]]],0,0],0,0,0,0],
            ["block","each",[["get","disk_types",["loc",[null,[188,24],[188,34]]],0,0,0,0]],[],3,null,["loc",[null,[188,16],[192,25]]]],
            ["block","if",[["get","imageLoading",["loc",[null,[204,18],[204,30]]],0,0,0,0]],[],4,5,["loc",[null,[204,12],[215,19]]]],
            ["inline","input",[],["type","text","name","diskSize","classNames","form-control","placeholder","Volume size in GB","value",["subexpr","@mut",[["get","model.profitbricksConfig.diskSize",["loc",[null,[226,112],[226,145]]],0,0,0,0]],[],[],0,0]],["loc",[null,[226,12],[226,147]]],0,0],
            ["inline","partial",["host/add-options"],[],["loc",[null,[229,4],[229,34]]],0,0],
            ["inline","top-errors",[],["errors",["subexpr","@mut",[["get","errors",["loc",[null,[233,32],[233,38]]],0,0,0,0]],[],[],0,0]],["loc",[null,[233,12],[233,40]]],0,0],
            ["block","if",[["get","waitData",["loc",[null,[235,14],[235,22]]],0,0,0,0]],[],6,7,["loc",[null,[235,8],[239,15]]]]
          ],
          locals: [],
          templates: [child0, child1, child2, child3, child4, child5, child6, child7]
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.9.1",
          "loc": {
            "source": null,
            "start": {
              "line": 121,
              "column": 2
            },
            "end": {
              "line": 241,
              "column": 2
            }
          }
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","if",[["get","step3",["loc",[null,[121,12],[121,17]]],0,0,0,0]],[],0,null,["loc",[null,[121,2],[241,2]]]]
        ],
        locals: [],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 40,
            "column": 2
          },
          "end": {
            "line": 241,
            "column": 2
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","if",[["get","step2",["loc",[null,[40,12],[40,17]]],0,0,0,0]],[],0,1,["loc",[null,[40,2],[241,2]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }());
  return {
    meta: {
      "revision": "Ember@2.9.1",
      "loc": {
        "source": null,
        "start": {
          "line": 1,
          "column": 0
        },
        "end": {
          "line": 242,
          "column": 10
        }
      }
    },
    isEmpty: false,
    arity: 0,
    cachedFragment: null,
    hasRendered: false,
    buildFragment: function buildFragment(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","horizontal-form");
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createComment("");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      return el0;
    },
    buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
      var morphs = new Array(1);
      morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
      return morphs;
    },
    statements: [
      ["block","if",[["get","step1",["loc",[null,[2,8],[2,13]]],0,0,0,0]],[],0,1,["loc",[null,[2,2],[241,9]]]]
    ],
    locals: [],
    templates: [child0, child1]
  };
}()));;

});
