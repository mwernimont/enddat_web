/* jslint browser: true */

define([
	'underscore',
	'backbone',
	'moment',
	'utils/dateUtils'
], function(_, Backbone, moment, dateUtils) {

	/*
	 * Models are xpected to have startDate and endDate property and to use the selected property to indicate that
	 * this model has been chosen (for further processing)
	 */
	var collection = Backbone.Collection.extend({

		hasSelectedVariables : function() {
			return this.some(function(model) {
				return model.has('selected') && model.get('selected');
			});
		},

		/*
		 * @returns {Array of models} where selected is set to true.
		 */
		getSelectedVariables : function() {
			return this.filter(function(model) {
				return model.has('selected') && model.get('selected');
			});
		},

		/*
		 * @returns {Object} - with start and end properties.
		 * returns the range of dates where each variable in the collection has data. If no such range
		 * return undefined.
		 */
		getOverlappingDateRange : function() {
			var dateRange = undefined;
			if (this.length !== 0) {
				dateRange = {
					start : moment.max(this.pluck('startDate')),
					end : moment.min(this.pluck('endDate'))
				};
				if (dateRange.start.isAfter(dateRange.end)) {
					dateRange = undefined;
				}
			}
			return dateRange;
		},

		/*
		 * @returns {Object} - with start and end properties.
		 * returns the range of dates where each variable in the collection has data. If no such range
		 * return undefined.
		 */
		getSelectedOverlappingDateRange : function() {
			var selectedVars = this.getSelectedVariables();
			var dateRange = undefined;
			if (selectedVars.length !== 0) {
				dateRange = {
					start : moment.max(_.map(selectedVars, function(model) { return model.get('startDate'); })),
					end : moment.min(_.map(selectedVars, function(model) { return model.get('endDate'); }))
				};
				if (dateRange.start.isAfter(dateRange.end)) {
					dateRange = undefined;
				}
			}
			return dateRange;
		}
	});

	return collection;
});