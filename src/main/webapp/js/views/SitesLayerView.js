/* jslint browser: true */

define([
	'underscore',
	'backbone',
	'leaflet',
	'Config',
	'leafletCustomControls/selectFilterControl',
	'utils/jqueryUtils',
	'utils/LUtils',
	'utils/VariableDatasetMapping',
	'views/BySiteLayerView',
	'views/ByVariableTypeLayerView',
	'views/GLCFSDataView',
	'views/ACISDataView',
	'views/NWISDataView',
	'views/PrecipDataView'
], function(_, Backbone, L, Config, selectFilterControl, $utils, LUtils, VariableDatasetMapping, BySiteLayerView, ByVariableTypeLayerView,
			GLCFSDataView, ACISDataView, NWISDataView, PrecipDataView) {
	"use strict";

	var siteIcons = _.mapObject(Config.DATASET_ICON, function(value) {
		return L.icon(value);
	});

	var getGLCFSTitle = function(model) {
		return model.get('variables').at(0).get('y') + ':' + model.get('variables').at(0).get('x');
	};

	var getNWISTitle = function(model) {
		return model.get('name');
	};

	var getPrecipTitle = function(model) {
		return model.get('variables').at(0).get('y') + ':' + model.get('variables').at(0).get('x');
	};

	var getACISTitle = function(model) {
		return model.get('name');
	};

	var getTitle = _.object([
  		[Config.GLCFS_DATASET, getGLCFSTitle],
		[Config.NWIS_DATASET, getNWISTitle],
		[Config.PRECIP_DATASET, getPrecipTitle],
		[Config.ACIS_DATASET, getACISTitle]
	]);

	var DataViews =_.object([
  		[Config.GLCFS_DATASET, GLCFSDataView],
		[Config.NWIS_DATASET, NWISDataView],
		[Config.PRECIP_DATASET, PrecipDataView],
		[Config.ACIS_DATASET, ACISDataView]
	]);

	var getVariableKindsOptions = function(model) {
		var variableKinds = model.get('variableKinds');
		var variableKindsMapping = _.pick(VariableDatasetMapping.getMapping(), variableKinds);

		return _.map(variableKindsMapping, function(varMapValue, varMapKey) {
			return {
				id : varMapKey,
				text : varMapValue.displayName
			};
		});
	};

	var MAP_WIDTH_CLASS = 'col-md-6';
	var DATA_VIEW_WIDTH_CLASS = 'col-md-6';

	var MAP_DIV_SELECTOR = '#map-div';
	var DATA_VIEW_CONTAINER = '.dataset-variable-container';

	/*
	 * This view will be rendered at initialization. A call to render will be a no op.
	 * The workflow step value determines whether the BySiteLayer or ByVariableTypeLayer view is created.
	 * @constructs
	 *
	 * @param {Object} options
	 *		@prop {Leaflet.Map} map
	 *		@prop {Jquery element} el - This should be the parent div of the div that contains the map.
	 *		@prop {WorkflowStateModel} model
	 */
	var view = Backbone.View.extend({

		initialize : function(options) {
			this.map = options.map;
			this.circleMarker = L.circleMarker([0, 0], {
				radius : 15
			});
			this.dataView = undefined;
			this.variableTypeFilterControl = undefined;
			this.siteLayers = _.object([
				[Config.GLCFS_DATASET, undefined],
				[Config.NWIS_DATASET, undefined],
				[Config.PRECIP_DATASET, undefined],
				[Config.ACIS_DATASET, undefined]
			]);

			if (this.model.has('datasetCollections')) {
				this.createSiteLayers();
			}
			else {
				this.listenToOnce(this.model, 'change:datasetCollections', this.createSiteLayers);
			}
		},

		removeDataView : function() {
			if (this.dataView) {
				this.dataView.remove();
				this.dataView = undefined;
			}
		},

		remove : function() {
			var $mapDiv = $(MAP_DIV_SELECTOR);
			var $dataViewDiv = $(DATA_VIEW_CONTAINER);

			this.removeDataView();
			if ($mapDiv.hasClass(MAP_WIDTH_CLASS)) {
				$mapDiv.removeClass(MAP_WIDTH_CLASS);
				$dataViewDiv.removeClass(DATA_VIEW_WIDTH_CLASS);
				this.map.invalidateSize();
			}

			if (this.variableTypeFilterControl) {
				this.map.removeControl(this.variableTypeFilterControl);
			}

			if (this.map.hasLayer(this.circleMarker)) {
				this.map.removeLayer(this.circleMarker);
			}
			_.each(this.siteLayers, function(siteLayer) {
				if (siteLayer) {
					siteLayer.remove();
				}
			});

			this.model.unset('selectedSite');
			return this;
		},

		createSiteLayers : function() {
			switch(this.model.get('step')) {
				case Config.CHOOSE_DATA_BY_SITE_FILTERS_STEP:
				case Config.CHOOSE_DATA_BY_SITE_VARIABLES_STEP:
					this.listenTo(this.model, 'change:selectedSite', this.updateSelectedSite);
					_.each(Config.ALL_DATASETS, function(dataset) {
						this.siteLayers[dataset] = new BySiteLayerView({
							map : this.map,
							model : this.model,
							el : this.el,
							datasetKind : dataset,
							siteIcon : siteIcons[dataset],
							getTitle : getTitle[dataset]
						});
					}, this);
					break;

				case Config.CHOOSE_DATA_BY_VARIABLES_STEP:
					this.listenTo(this.model, 'change:variableKinds', this.updateVariableKindControl);
					this.updateVariableKindControl();
					_.each(Config.ALL_DATASETS, function(dataset) {
						this.siteLayers[dataset] = new ByVariableTypeLayerView({
							map : this.map,
							model : this.model,
							el : this.el,
							datasetKind : dataset,
							siteIcon : siteIcons[dataset],
							getTitle : getTitle[dataset]
						});
					}, this);
					break;
			}
		},

		/*
		 * Model event listeners
		 */

		updateSelectedSite : function() {
			var selectedSite = (this.model.has('selectedSite')) ? this.model.get('selectedSite') : undefined;
			var projectBounds = LUtils.getLatLngBounds(this.model.get('aoi').getBoundingBox());
			var projectLocation = projectBounds.getCenter();
			var siteLatLng;
			var $mapDiv = this.$(MAP_DIV_SELECTOR);
			var $dataViewDiv = this.$(DATA_VIEW_CONTAINER);

			this.removeDataView();
			if (selectedSite) {
				siteLatLng = L.latLng(selectedSite.siteModel.attributes.lat, selectedSite.siteModel.attributes.lon);
				this.circleMarker.setLatLng(siteLatLng);
				if (!this.map.hasLayer(this.circleMarker)) {
					this.map.addLayer(this.circleMarker);
				}
				this.dataView = new DataViews[selectedSite.datasetKind]({
					el : $utils.createDivInContainer($dataViewDiv),
					distanceToProjectLocation : LUtils.milesBetween(projectLocation, siteLatLng).toFixed(3),
					model : selectedSite.siteModel,
					opened : true
				});
				this.dataView.render();
				if (!$mapDiv.hasClass(MAP_WIDTH_CLASS)) {
					$mapDiv.addClass(MAP_WIDTH_CLASS);
					$dataViewDiv.addClass(DATA_VIEW_WIDTH_CLASS);
					this.map.invalidateSize();
				}
			}
			else if (this.map.hasLayer(this.circleMarker)) {
				this.map.removeLayer(this.circleMarker);
				$mapDiv.removeClass(MAP_WIDTH_CLASS);
				$dataViewDiv.removeClass(DATA_VIEW_WIDTH_CLASS);
				this.map.invalidateSize();
			}
		},

		updateVariableKindControl : function() {
			var prevVarKinds = this.model.previous('variableKinds');
			var newVarKinds = this.model.has('variableKinds') ? this.model.get('variableKinds') : [];
			var addedKinds = _.difference(newVarKinds, prevVarKinds);

			if (this.variableTypeFilterControl)  {
				if (newVarKinds.length === 0) {
					this.map.removeControl(this.variableTypeFilterControl);
					this.variableTypeFilterControl = undefined;
					this.model.unset('selectedVarKind');
				}
				else {
					var filterVarKind = this.variableTypeFilterControl.getValue();
					var newFilterValue;

					this.variableTypeFilterControl.updateFilterOptions(getVariableKindsOptions(this.model));
					// Set the newFilterValue to the variableKind that was added. If none were added,
					// then set the filter value to the current value of the filter if it is still in variableKinds.
					// Otherwise set to the first value in variableKinds
					if (addedKinds.length > 0) {
						newFilterValue = addedKinds[0];
					}
					else if (_.contains(newVarKinds, filterVarKind)) {
						newFilterValue = filterVarKind;
					}
					else {
						newFilterValue = newVarKinds[0];
					}
					this.variableTypeFilterControl.setValue(newFilterValue);
					this.model.set('selectedVarKind', newFilterValue);
				}
			}
			else if (newVarKinds.length > 0) {
				this.variableTypeFilterControl = selectFilterControl({
					filterOptions : getVariableKindsOptions(this.model),
					initialValue : newVarKinds[0],
					tooltip : 'Select variable to show on map',
					changeHandler : _.bind(this.updateSelectedVarKind, this)
				});
				this.map.addControl(this.variableTypeFilterControl);
				this.model.set('selectedVarKind', newVarKinds[0]);
			}
		},
		/*
		 * DOM event handlers
		 */

		/*
		 * Handles the change event for the Leaflet variable type control
		 */
		updateSelectedVarKind : function(ev) {
			this.model.set('selectedVarKind', $(ev.target).val());
		}
	});

	return view;
});


