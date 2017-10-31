define('ui/components/machine/driver-%%DRIVERNAME%%/component',
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
    var selImage = 'ubuntu:latest';
    var selDataCenter;
    var datacentersList;

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
            name: '3GB',
            value: 3072
        }, {
            name: '4GB',
            value: 4096
        }, {
            name: '6GB',
            value: 6144
        }, {
            name: '8GB',
            value: 8192
        }, {
            name: '12GB',
            value: 12288
        }, {
            name: '16GB',
            value: 16384
        }, {
            name: '32GB',
            value: 32768
        }
    ];
    const cores = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const disk_types = ['SSD', 'HDD'];

    exports['default'] = _ember['default'].Component.extend(_uiMixinsDriver['default'], {
            driverName: '%%DRIVERNAME%%',
            model: null,
            '%%DRIVERNAME%%Config': Ember.computed.alias('model.%%DRIVERNAME%%Config'),
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
            canAuthenticate: Ember.computed.and('model.%%DRIVERNAME%%Config.username', 'model.%%DRIVERNAME%%Config.password'),

            bootstrap() {
                let config = this.get('store').createRecord({
                        type: '%%DRIVERNAME%%Config'
                    });
                let type = 'host';
                if (!this.get('useHost')) {
                    type = 'machine';
                }

                this.set('model', this.get('store').createRecord({
                        type: type,
                        '%%DRIVERNAME%%Config': config
                    }));
                this.set('editing', false);

            },
            validate() {
                this._super();

                let errors = this.get('errors') || [],
                model = this.get('model.%%DRIVERNAME%%Config'),
                error_keys = {
                    cores: '"Cores" is required',
                    cpuFamily: '"CPU family" is required',
                    diskSize: '"Volume size" is required',
                    diskType: '"Disk type" is required',
                    image: '"Image" is required',
                    location: '"Location" is required',
                    ram: '"RAM" is required'
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

                var auth = 'Basic ' + btoa(this.get('model.%%DRIVERNAME%%Config.username') + ':' + this.get('model.%%DRIVERNAME%%Config.password'));
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

                var auth = 'Basic ' + btoa(this.get('model.%%DRIVERNAME%%Config.username') + ':' + this.get('model.%%DRIVERNAME%%Config.password'));
                var body = {
                    "properties": {
                        "name": this.get('model.%%DRIVERNAME%%Config.datacenterName'),
                        "description": this.get('model.%%DRIVERNAME%%Config.datacenterName'),
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

                    this.setProperties({
                        images: filteredImages,
                        imageLoading: false,
                    });
                    this.getImage(filteredImages[0].id);

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
                        this.set('model.%%DRIVERNAME%%Config.image', hash.curImage.properties.imageAliases[0]);
                        this.setProperties({
                            waitData: false,
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
                        this.set('model.%%DRIVERNAME%%Config.datacenterId', hash.datacenter.id);
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
                    this.set('model.%%DRIVERNAME%%Config.location', selDataCenter.properties.location);                 
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
                            this.set('model.%%DRIVERNAME%%Config.datacenterId', hash.datacenters.items[0].id);
                            this.set('model.%%DRIVERNAME%%Config.location', hash.datacenters.items[0].properties.location);
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
                    this.set('model.%%DRIVERNAME%%Config.location', loc);
                    selLocation = loc;
                    this.getImages()
                },
                selectDataCenter(dc) {
                    this.set('model.%%DRIVERNAME%%Config.datacenterId', dc);                    
                    selDataCenter = this.getDatacenter(dc);
                },
                selectCpuFamily(cpu_family) {
                    this.set('model.%%DRIVERNAME%%Config.cpuFamily', cpu_family);
                },
                selectCores(cores) {
                    this.set('model.%%DRIVERNAME%%Config.cores', cores)
                },
                selectRam(ram) {
                    this.set('model.%%DRIVERNAME%%Config.ram', ram);
                },
                selectDiskType(type) {
                    selDiskType = type;
                    this.set('model.%%DRIVERNAME%%Config.diskType', type);
                },
                create() {
                    // console.log(this.get('model.%%DRIVERNAME%%Config'));
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
