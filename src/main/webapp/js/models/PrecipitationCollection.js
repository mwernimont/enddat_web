/* jslint browser: true */

define([
	'loglevel',
	'module',
	'jquery',
	'backbone',
	'moment',
	'utils/jqueryUtils'
], function(log, module, $, Backbone, moment, $utils) {
	"use strict";

	var getInteger = function(str) {
		return str.split('.')[0];
	};

	var START_DATE = '2002-01-01';

	var collection = Backbone.Collection.extend({

		url : module.config().precipWFSGetFeatureUrl,

		/*
		 * Parse the {Document} and returns a json object which can be used to create the collection.
		 * @param {Document} xml
		 * @returns {Array of Objects}
		 */
		parse : function(xml) {
			var result = [];
			var today = moment().format('YYYY-MM-DD');
			$utils.xmlFind($(xml), 'wfs', 'member').each(function() {
				var $this = $(this);

				result.push({
					x : getInteger($utils.xmlFind($this, 'sb', 'x').text()),
					y : getInteger($utils.xmlFind($this, 'sb', 'y').text()),
					lon : $utils.xmlFind($this, 'sb', 'X1').text(),
					lat : $utils.xmlFind($this, 'sb', 'X2').text(),
					startDate : START_DATE,
					endDate : today
				});
			});
			return result;
		},

		/*
		 * Fetches the precipitation grid data for the specified bounding box and updates the collection contents.
		 * If the fetch fails the collection is reset
		 * @param {Object} boundingBox - west, east, north, and south properties
		 * @returns a promise. Both rejected and resolved return the original jqXHR
		 */
		fetch : function (boundingBox) {
			var self = this;
			var fetchDeferred = $.Deferred();

			$.ajax({
				url : this.url,
				data : {
					srsName : 'EPSG:4269',
					bbox : [boundingBox.south, boundingBox.west, boundingBox.north, boundingBox.east].join(',')
				},
				success : function(xml, textStatus, jqXHR) {
					if ($utils.xmlFind($(xml), 'ows', 'ExceptionReport').length > 0) {
						log.debug('Precipitation fetch failed with Exception from service');
						self.reset([]);
						fetchDeferred.reject(jqXHR);
					}
					else {
						self.reset(self.parse(xml));
						log.debug('Precipitation fetch succeeded, fetched ' + self.size() + ' grid');
						fetchDeferred.resolve(jqXHR);
					}
				},
				error : function(jqXHR) {
					log.debug('Precipitation fetch failed');
					self.reset([]);
					fetchDeferred.reject(jqXHR);
				}
			});

			return fetchDeferred.promise();
		}

	});

	return collection;
});

