YUI.add('autocomplete-base', function(Y) {

/**
 * Provides automatic input completion or suggestions for text input fields and
 * textareas.
 *
 * @module autocomplete
 * @since 3.3.0
 */

/**
 * <code>Y.Base</code> extension that provides core autocomplete logic (but no
 * UI implementation) for a text input field or textarea. Must be mixed into a
 * <code>Y.Base</code>-derived class to be useful.
 *
 * @module autocomplete
 * @submodule autocomplete-base
 */

/**
 * <p>
 * Extension that provides core autocomplete logic (but no UI implementation)
 * for a text input field or textarea.
 * </p>
 *
 * <p>
 * The <code>AutoCompleteBase</code> class provides events and attributes that
 * abstract away core autocomplete logic and configuration, but does not provide
 * a widget implementation or suggestion UI. For a prepackaged autocomplete
 * widget, see <code>AutoCompleteList</code>.
 * </p>
 *
 * <p>
 * This extension cannot be instantiated directly, since it doesn't provide an
 * actual implementation. It's intended to be mixed into a
 * <code>Base</code>-based class or widget, as illustrated in the following
 * example:
 * </p>
 *
 * <pre>
 * YUI().use('autocomplete-base', 'base', function (Y) {
 * &nbsp;&nbsp;var MyAutoComplete = Y.Base.create('myAutocomplete', Y.Base, [Y.AutoComplete], {
 * &nbsp;&nbsp;&nbsp;&nbsp;initializer: function () {
 * &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;this.bindInput();
 * &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;this.syncInput();
 * &nbsp;&nbsp;&nbsp;&nbsp;},
 * &nbsp;
 * &nbsp;&nbsp;&nbsp;&nbsp;destructor: function () {
 * &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;this.unbindInput();
 * &nbsp;&nbsp;&nbsp;&nbsp;}
 * &nbsp;&nbsp;});
 * &nbsp;
 * &nbsp;&nbsp;// ... custom implementation code ...
 * });
 * </pre>
 *
 * @class AutoCompleteBase
 */

var Lang    = Y.Lang,
    YArray  = Y.Array,
    YObject = Y.Object,

    isArray    = Lang.isArray,
    isFunction = Lang.isFunction,
    isObject   = Lang.isObject,
    trim       = Lang.trim,

    INVALID_VALUE = Y.Attribute.INVALID_VALUE,

    _FUNCTION_VALIDATOR = '_functionValidator',
    _SOURCE_SUCCESS     = '_sourceSuccess',
    INPUT_NODE          = 'inputNode',
    QUERY               = 'query',
    QUERY_DELIMITER     = 'queryDelimiter',
    REQUEST_TEMPLATE    = 'requestTemplate',
    RESULTS             = 'results',
    RESULT_LIST_LOCATOR = 'resultListLocator',
    VALUE               = 'value',
    VALUE_CHANGE        = 'valueChange',

    EVT_CLEAR   = 'clear',
    EVT_QUERY   = QUERY,
    EVT_RESULTS = RESULTS;

function AutoCompleteBase() {
    /**
     * Fires after the query has been completely cleared or no longer meets the
     * minimum query length requirement.
     *
     * @event clear
     * @param {EventFacade} e Event facade with the following additional
     *   properties:
     *
     * <dl>
     *   <dt>prevVal (String)</dt>
     *   <dd>
     *     Value of the query before it was cleared.
     *   </dd>
     * </dl>
     *
     * @preventable _defClearFn
     */
    this.publish(EVT_CLEAR, {
        defaultFn: this._defClearFn,
        queueable: true
    });

    /**
     * Fires when the contents of the input field have changed and the input
     * value meets the criteria necessary to generate an autocomplete query.
     *
     * @event query
     * @param {EventFacade} e Event facade with the following additional
     *   properties:
     *
     * <dl>
     *   <dt>inputValue (String)</dt>
     *   <dd>
     *     Full contents of the text input field or textarea that generated
     *     the query.
     *   </dd>
     *
     *   <dt>query (String)</dt>
     *   <dd>
     *     Autocomplete query. This is the string that will be used to
     *     request completion results. It may or may not be the same as
     *     <code>inputValue</code>.
     *   </dd>
     * </dl>
     *
     * @preventable _defQueryFn
     */
    this.publish(EVT_QUERY, {
        defaultFn: this._defQueryFn,
        queueable: true
    });

    /**
     * Fires after query results are received from the DataSource. If no
     * DataSource has been set, this event will not fire.
     *
     * @event results
     * @param {EventFacade} e Event facade with the following additional
     *   properties:
     *
     * <dl>
     *   <dt>data (Array|Object)</dt>
     *   <dd>
     *     Raw, unfiltered result data (if available).
     *   </dd>
     *
     *   <dt>query (String)</dt>
     *   <dd>
     *     Query that generated these results.
     *   </dd>
     *
     *   <dt>results (Array)</dt>
     *   <dd>
     *     Array of filtered, formatted, and highlighted results. Each item in
     *     the array is an object with the following properties:
     *
     *     <dl>
     *       <dt>display (Node|HTMLElement|String)</dt>
     *       <dd>
     *         Formatted result HTML suitable for display to the user.
     *       </dd>
     *
     *       <dt>raw (mixed)</dt>
     *       <dd>
     *         Raw, unformatted result in whatever form it was provided by the
     *         DataSource.
     *       </dd>
     *
     *       <dt>text (String)</dt>
     *       <dd>
     *         Plain text version of the result, suitable for being inserted
     *         into the value of a text input field or textarea when the result
     *         is selected by a user.
     *       </dd>
     *     </dl>
     *   </dd>
     * </dl>
     *
     * @preventable _defResultsFn
     */
    this.publish(EVT_RESULTS, {
        defaultFn: this._defResultsFn,
        queueable: true
    });
}

// -- Public Static Properties -------------------------------------------------
AutoCompleteBase.ATTRS = {
    /**
     * Whether or not to enable the browser's built-in autocomplete
     * functionality for input fields.
     *
     * @attribute allowBrowserAutocomplete
     * @type Boolean
     * @default false
     * @writeonce
     */
    allowBrowserAutocomplete: {
        value: false,
        writeOnce: 'initOnly'
    },

    /**
     * Node to monitor for changes, which will generate <code>query</code>
     * events when appropriate. May be either an input field or a textarea.
     *
     * @attribute inputNode
     * @type Node|HTMLElement|String
     * @writeonce
     */
    inputNode: {
        setter: Y.one,
        writeOnce: 'initOnly'
    },

    /**
     * Maximum number of results to return. A value of <code>0</code> or less
     * will allow an unlimited number of results.
     *
     * @attribute maxResults
     * @type Number
     * @default 0
     */
    maxResults: {
        value: 0
    },

    /**
     * Minimum number of characters that must be entered before a
     * <code>query</code> event will be fired. A value of <code>0</code>
     * allows empty queries; a negative value will effectively disable all
     * <code>query</code> events.
     *
     * @attribute minQueryLength
     * @type Number
     * @default 1
     */
    minQueryLength: {
        value: 1
    },

    /**
     * <p>
     * Current query, or <code>null</code> if there is no current query.
     * </p>
     *
     * <p>
     * The query might not be the same as the current value of the input
     * node, both for timing reasons (due to <code>queryDelay</code>) and
     * because when one or more <code>queryDelimiter</code> separators are
     * in use, only the last portion of the delimited input string will be
     * used as the query value.
     * </p>
     *
     * @attribute query
     * @type String|null
     * @default null
     * @readonly
     */
    query: {
        readOnly: true,
        value: null
    },

    /**
     * <p>
     * Number of milliseconds to delay after input before triggering a
     * <code>query</code> event. If new input occurs before this delay is
     * over, the previous input event will be ignored and a new delay will
     * begin.
     * </p>
     *
     * <p>
     * This can be useful both to throttle queries to a remote data source
     * and to avoid distracting the user by showing them less relevant
     * results before they've paused their typing.
     * </p>
     *
     * @attribute queryDelay
     * @type Number
     * @default 100
     */
    queryDelay: {
        value: 100
    },

    /**
     * Query delimiter string. When a delimiter is configured, the input value
     * will be split on the delimiter, and only the last portion will be used in
     * autocomplete queries and updated when the <code>query</code> attribute is
     * modified.
     *
     * @attribute queryDelimiter
     * @type String|null
     * @default null
     */
    queryDelimiter: {
        value: null
    },

    /**
     * <p>
     * DataSource request template. This can be a function that accepts a
     * query as a parameter and returns a request string, or it can be a
     * string containing the placeholder "{query}", which will be replaced
     * with the actual URI-encoded query.
     * </p>
     *
     * <p>
     * While <code>requestTemplate</code> may be set to either a function or
     * a string, it will always be returned as a function that accepts a
     * query argument and returns a string.
     * </p>
     *
     * @attribute requestTemplate
     * @type Function|String|null
     * @default null
     */
    requestTemplate: {
        setter: '_setRequestTemplate',
        value: null
    },

    /**
     * <p>
     * Array of local result filter functions. If provided, each filter
     * will be called with two arguments when results are received: the query
     * and an array of results (as returned by the <code>resultLocator</code>,
     * if one is set).
     * </p>
     *
     * <p>
     * Each filter is expected to return a filtered or modified version of the
     * results, which will then be passed on to subsequent filters, then the
     * <code>resultHighlighter</code> function (if set), then the
     * <code>resultFormatter</code> function (if set), and finally to
     * subscribers to the <code>results</code> event.
     * </p>
     *
     * <p>
     * If no DataSource is set, result filters will not be called.
     * </p>
     *
     * @attribute resultFilters
     * @type Array
     * @default []
     */
    resultFilters: {
        validator: isArray,
        value: []
    },

    /**
     * <p>
     * Function which will be used to format results. If provided, this function
     * will be called with four arguments after results have been received and
     * filtered: the query, an array of raw results, an array of highlighted
     * results, and an array of plain text results. The formatter is expected to
     * return a modified copy of the results array with any desired custom
     * formatting applied.
     * </p>
     *
     * <p>
     * If no DataSource is set, the formatter will not be called.
     * </p>
     *
     * @attribute resultFormatter
     * @type Function|null
     */
    resultFormatter: {
        validator: _FUNCTION_VALIDATOR
    },

    /**
     * <p>
     * Function which will be used to highlight results. If provided, this
     * function will be called with two arguments after results have been
     * received and filtered: the query and an array of filtered results. The
     * highlighter is expected to return a modified version of the results
     * array with the query highlighted in some form.
     * </p>
     *
     * <p>
     * If no DataSource is set, the highlighter will not be called.
     * </p>
     *
     * @attribute resultHighlighter
     * @type Function|null
     */
    resultHighlighter: {
        validator: _FUNCTION_VALIDATOR
    },

    /**
     * <p>
     * Locator that should be used to extract an array of results from a
     * non-array response.
     * </p>
     *
     * <p>
     * By default, no locator is applied, and all responses are assumed to be
     * arrays by default. If all responses are already arrays, you don't need to
     * define a locator.
     * </p>
     *
     * <p>
     * The locator may be either a function (which will receive the raw response
     * as an argument and must return an array) or a string representing an
     * object path, such as "foo.bar.baz" (which would return the value of
     * <code>result.foo.bar.baz</code> if the response is an object).
     * </p>
     *
     * <p>
     * While <code>resultListLocator</code> may be set to either a function or a
     * string, it will always be returned as a function that accepts a response
     * argument and returns an array.
     * </p>
     *
     * @attribute resultListLocator
     * @type Function|String|null
     */
    resultListLocator: {
        setter: '_setLocator'
    },

    /**
     * Current results, or an empty array if there are no results.
     *
     * @attribute results
     * @type Array
     * @default []
     * @readonly
     */
    results: {
        readOnly: true,
        value: []
    },

    /**
     * <p>
     * Locator that should be used to extract a plain text string from a
     * non-string result item. The resulting text value will be fed to any
     * defined filters, and will typically also be the value that ends up being
     * inserted into an input field or textarea when the user of an autocomplete
     * implementation selects a result.
     * </p>
     *
     * <p>
     * By default, no locator is applied, and all results are assumed to be
     * plain text strings. If all results are already plain text strings, you
     * don't need to define a locator.
     * </p>
     *
     * <p>
     * The locator may be either a function (which will receive the raw result
     * as an argument and must return a string) or a string representing an
     * object path, such as "foo.bar.baz" (which would return the value of
     * <code>result.foo.bar.baz</code> if the result is an object).
     * </p>
     *
     * <p>
     * While <code>resultTextLocator</code> may be set to either a function or a
     * string, it will always be returned as a function that accepts a result
     * argument and returns a string.
     * </p>
     *
     * @attribute resultTextLocator
     * @type Function|String|null
     */
    resultTextLocator: {
        setter: '_setLocator'
    },

    /**
     * <p>
     * Source for autocomplete results. The following source types are
     * supported:
     * </p>
     *
     * <dl>
     *   <dt>Array</dt>
     *   <dd>
     *     <p>
     *     <i>Example:</i> <code>['first result', 'second result', 'etc']</code>
     *     </p>
     *
     *     <p>
     *     The full array will be provided to any configured filters for each
     *     query. This is an easy way to create a fully client-side autocomplete
     *     implementation.
     *     </p>
     *   </dd>
     *
     *   <dt>DataSource</dt>
     *   <dd>
     *     <p>
     *     A <code>DataSource</code> instance or other object that provides a
     *     DataSource-like <code>sendRequest</code> method. See the
     *     <code>DataSource</code> documentation for details.
     *     </p>
     *   </dd>
     *
     *   <dt>Object</dt>
     *   <dd>
     *     <p>
     *     <i>Example:</i> <code>{foo: ['foo result 1', 'foo result 2'], bar: ['bar result']}</code>
     *     </p>
     *
     *     <p>
     *     An object will be treated as a query hashmap. If a property on the
     *     object matches the current query, the value of that property will be
     *     used as the response.
     *     </p>
     *
     *     <p>
     *     The response is assumed to be an array of results by default. If the
     *     response is not an array, provide a <code>resultListLocator</code> to
     *     process the response and return an array.
     *     </p>
     *   </dd>
     *
     *   <dt>String (JSONP URL)</dt>
     *   <dd>
     *     <p>
     *     <i>Example:</i> <code>'http://example.com/search?q={query}&callback={callback}'</code>
     *     </p>
     *
     *     <p>
     *     If a URL is provided, it will be used to make a JSONP request. The
     *     <code>{query}</code> placeholder will be replaced with the current
     *     query, and the <code>{callback}</code> placeholder will be replaced with
     *     an internally-generated JSONP callback name. Both placeholders must
     *     appear in the URL, or the request will fail.
     *     </p>
     *
     *     <p>
     *     The response is assumed to be an array of results by default. If the
     *     response is not an array, provide a <code>resultListLocator</code> to
     *     process the response and return an array.
     *     </p>
     *
     *     <p>
     *     <strong>The <code>jsonp</code> module must be loaded in order for URL
     *     sources to work.</strong> If the <code>jsonp</code> module is not
     *     loaded, an error will be logged and autocomplete requests will fail.
     *     </p>
     *   </dd>
     *
     *   <dt>String (YQL query)</dt>
     *   <dd>
     *     <p>
     *     <i>Example:</i> <code>'select * from search.suggest where query="{query}"'</code>
     *     </p>
     *
     *     <p>
     *     If a YQL "SELECT" query is provided, it will be used to make a YQL
     *     request. The <code>{query}</code> placeholder will be replaced with
     *     the current autocomplete query. This placeholder must appear in the
     *     YQL query, or the request will fail.
     *     </p>
     *
     *     <p>
     *     <strong>The <code>yql</code> module must be loaded in order for YQL
     *     sources to work.</strong> If the <code>yql</code> module is not
     *     loaded, an error will be logged and autocomplete requests will fail.
     *     </p>
     *   </dd>
     * </dl>
     *
     * <p>
     * As an alternative to providing a source, you could also simply listen for
     * <code>query</code> events and handle them any way you see fit. Providing
     * a source is optional, but will usually be simpler.
     * </p>
     *
     * @attribute source
     * @type Array|DataSource|Object|String|null
     */
    source: {
        setter: '_setSource'
    },

    /**
     * Current value of the input node.
     *
     * @attribute value
     * @type String
     * @default ''
     */
    value: {
        // Why duplicate this._inputNode.get('value')? Because we need a
        // reliable way to track the source of value changes. We want to perform
        // completion when the user changes the value, but not when we change
        // the value.
        value: ''
    }
};

AutoCompleteBase.CSS_PREFIX = 'ac';
AutoCompleteBase.UI_SRC = (Y.Widget && Y.Widget.UI_SRC) || 'ui';

AutoCompleteBase.prototype = {
    // -- Public Lifecycle Methods ---------------------------------------------

    /**
     * Attaches <code>inputNode</code> event listeners.
     *
     * @method bindInput
     */
    bindInput: function () {
        var inputNode = this.get(INPUT_NODE);

        if (!inputNode) {
            Y.error('No inputNode specified.');
        }

        // Unbind first, just in case.
        this.unbindInput();

        this._inputEvents = [
            // This is the valueChange event on the inputNode provided by the
            // event-valuechange module, not our own valueChange.
            inputNode.on(VALUE_CHANGE, this._onInputValueChange, this),

            // And here's our own valueChange event.
            this.after(VALUE_CHANGE, this._afterValueChange, this)
        ];
    },

    /**
     * Synchronizes the UI state of the <code>inputNode</code>.
     *
     * @method syncInput
     */
    syncInput: function () {
        var inputNode = this.get(INPUT_NODE);

        if (inputNode.get('nodeName').toLowerCase() === 'input') {
            inputNode.setAttribute('autocomplete',
                    this.get('allowBrowserAutocomplete') ? 'on' : 'off');
        }

        this.set(VALUE, inputNode.get(VALUE));
    },

    /**
     * Detaches <code>inputNode</code> event listeners.
     *
     * @method unbindInput
     */
    unbindInput: function () {
        var inputEvents = this._inputEvents;

        while (inputEvents && inputEvents.length) {
            inputEvents.pop().detach();
        }
    },

    // -- Protected Prototype Methods ------------------------------------------

    /**
     * Creates a DataSource-like object that simply returns the specified array
     * as a response. See the <code>source</code> attribute for more details.
     *
     * @method _createArraySource
     * @param {Array} source
     * @return {Object} DataSource-like object.
     * @protected
     */
    _createArraySource: function (source) {
        var that = this;

        return {sendRequest: function (request) {
            that[_SOURCE_SUCCESS](source.concat(), request);
        }};
    },

    /**
     * Creates a DataSource-like object that uses the specified JSONPRequest
     * instance as a source. See the <code>source</code> attribute for more
     * details.
     *
     * @method _createJSONPSource
     * @param {JSONPRequest} source
     * @return {Object} DataSource-like object.
     * @protected
     */
    _createJSONPSource: function (source) {
        var cache = {},
            that  = this;

        return {sendRequest: function (request) {
            var query = request.request;

            if (cache[query]) {
                that[_SOURCE_SUCCESS](cache[query], request);
            } else {
                // Hack alert: JSONPRequest currently doesn't support
                // per-request callbacks, so we're reaching into the protected
                // _config object to make it happen.
                //
                // This limitation is mentioned in the following JSONP
                // enhancement ticket:
                //
                // http://yuilibrary.com/projects/yui3/ticket/2529371
                source._config.on.success = function (data) {
                    cache[query] = data;
                    that[_SOURCE_SUCCESS](data, request);
                };

                source.send(query);
            }
        }};
    },

    /**
     * Creates a DataSource-like object that looks up queries as properties on
     * the specified object, and returns the found value (if any) as a response.
     * See the <code>source</code> attribute for more details.
     *
     * @method _createObjectSource
     * @param {Object} source
     * @return {Object} DataSource-like object.
     * @protected
     */
    _createObjectSource: function (source) {
        return {sendRequest: function (request) {
            var query = request.request,
                that  = this;

            that[_SOURCE_SUCCESS](
                YObject.owns(source, query) ? source[query] : [],
                request
            );
        }};
    },

    /**
     * <p>
     * Creates a DataSource-like object that calls the specified JSONP
     * URL or executes the specified YQL query for results. If the string starts
     * with "select " (case-insensitive), it's assumed to be a YQL query;
     * otherwise, it's assumed to be a URL (which may be absolute or relative).
     * See the <code>source</code> attribute for more details.
     * </p>
     *
     * <p>
     * Note: depending on the string format, either the <code>jsonp</code>
     * module or the <code>yql</code> module (both optional dependencies) will
     * be required. If the necessary module is not loaded,
     * <code>Y.Attribute.INVALID_VALUE</code> will be returned and an error will
     * be logged.
     * </p>
     *
     * @method _createStringSource
     * @param {String} source JSONP URL or YQL query.
     * @return {Object} DataSource-like object.
     * @protected
     */
    _createStringSource: function (source) {
        var that = this;

        if (/^select\s+/i.test(source)) {
            // Looks like a YQL query.
            if (Y.YQLRequest) {
                return this._createYQLSource(source);
            } else {
                Y.error('yql module is not loaded');
                return INVALID_VALUE;
            }
        } else {
            // Doesn't look like a YQL query, so assume it's a URL.
            if (Y.JSONPRequest) {
                return this._createJSONPSource(new Y.JSONPRequest(source, {
                    format: function (url, proxy, query) {
                        return Lang.sub(url, {
                            callback: proxy,

                            // If a requestTemplate is set, assume that it will
                            // handle URI encoding if necessary. Otherwise,
                            // encode the query.
                            query: that.get(REQUEST_TEMPLATE) ? query :
                                    encodeURIComponent(query)
                        });
                    }
                }));
            } else {
                Y.error('jsonp module is not loaded');
                return INVALID_VALUE;
            }
        }
    },

    /**
     * Creates a DataSource-like object that uses the specified YQL query string
     * to create a YQL-based source. See the <code>source</code> attribute for
     * details. If no <code>resultListLocator</code> is defined, this method
     * will set a best-guess locator that might work for many typical YQL
     * queries.
     *
     * @method _createYQLSource
     * @param {String} source YQL query.
     * @return {Object} DataSource-like object.
     * @protected
     */
    _createYQLSource: function (source) {
        var cache = {},
            that  = this;

        if (!this.get(RESULT_LIST_LOCATOR)) {
            this.set(RESULT_LIST_LOCATOR, this._defaultYQLLocator);
        }

        return {sendRequest: function (request) {
            var query = request.request;

            if (!that.get(REQUEST_TEMPLATE)) {
                query = encodeURIComponent(query);
            }

            if (cache[query]) {
                that[_SOURCE_SUCCESS](cache[query], request);
            } else {
                Y.YQL(Lang.sub(source, {query: query}), function (data) {
                    cache[query] = data;
                    that[_SOURCE_SUCCESS](data, request);
                });
            }
        }};
    },

    /**
     * Default resultListLocator used when a string-based YQL source is set and
     * the implementer hasn't already specified one.
     *
     * @method _defaultYQLLocator
     * @param {Object} response YQL response object.
     * @return {Array}
     * @protected
     */
    _defaultYQLLocator: function (response) {
        var results = response && response.query && response.query.results,
            values;

        if (results && isObject(results)) {
            // If there's only a single value on YQL's results object, that
            // value almost certainly contains the array of results we want. If
            // there are 0 or 2+ values, then the values themselves are most
            // likely the results we want.
            values  = YObject.values(results) || [];
            results = values.length === 1 ? values[0] : values;
        } else {
            results = [];
        }

        return results;
    },

    /**
     * Returns <code>true</code> if <i>value</i> is either a function or
     * <code>null</code>.
     *
     * @method _functionValidator
     * @param {Function|null} value Value to validate.
     * @protected
     */
    _functionValidator: function (value) {
        return value === null || isFunction(value);
    },

    /**
     * Faster and safer alternative to Y.Object.getValue(). Doesn't bother
     * casting the path to an array (since we already know it's an array) and
     * doesn't throw an error if a value in the middle of the object hierarchy
     * is neither <code>undefined</code> nor an object.
     *
     * @method _getObjectValue
     * @param {Object} obj
     * @param {Array} path
     * @return {mixed} Located value, or <code>undefined</code> if the value was
     *   not found at the specified path.
     * @protected
     */
    _getObjectValue: function (obj, path) {
        if (!obj) {
            return;
        }

        for (var i = 0, len = path.length; obj && i < len; i++) {
            obj = obj[path[i]];
        }

        return obj;
    },

    /**
     * Parses result responses, performs filtering and highlighting, and fires
     * the <code>results</code> event.
     *
     * @method _parseResponse
     * @param {String} query Query that generated these results.
     * @param {Object} response Response containing results.
     * @param {Object} data Raw response data.
     * @protected
     */
    _parseResponse: function (query, response, data) {
        var facade = {
                data   : data,
                query  : query,
                results: []
            },

            // Filtered result arrays representing different formats. These will
            // be unrolled into the final array of result objects as properties.
            formatted,   // HTML, Nodes, whatever
            raw,         // whatever format came back in the response
            unformatted, // plain text (ideally)

            // Unfiltered raw results, fresh from the response.
            unfiltered = response && response.results,

            // Final array of result objects.
            results = [],

            // Other stuff.
            filters,
            formatter,
            highlighter,
            i,
            len,
            listLocator = this.get(RESULT_LIST_LOCATOR),
            maxResults,
            textLocator,
            textLocatorMap;

        if (unfiltered && listLocator) {
            unfiltered = listLocator(unfiltered);
        }

        if (unfiltered) {
            filters     = this.get('resultFilters');
            formatter   = this.get('resultFormatter');
            highlighter = this.get('resultHighlighter');
            maxResults  = this.get('maxResults');
            textLocator = this.get('resultTextLocator');

            if (textLocator) {
                // In order to allow filtering based on locator queries, we have
                // to create a mapping of "located" results to original results
                // so we can sync up the original results later without
                // requiring the filters to do extra work.
                raw            = YArray.map(unfiltered, textLocator);
                textLocatorMap = YArray.hash(raw, unfiltered);
            } else {
                raw = unfiltered;
            }

            // Run the raw results through all configured result filters.
            for (i = 0, len = filters.length; i < len; ++i) {
                raw = filters[i](query, raw);

                if (!raw || !raw.length) {
                    break;
                }
            }

            if (textLocator) {
                // Sync up the original results with the filtered, "located"
                // results.
                unformatted = raw;
                raw = [];

                for (i = 0, len = unformatted.length; i < len; ++i) {
                    raw.push(textLocatorMap[unformatted[i]]);
                }
            } else {
                unformatted = [].concat(raw);
            }

            // Run the unformatted results through the configured highlighter
            // (if any) to produce the first stage of formatted results.
            formatted = highlighter ? highlighter(query, unformatted) :
                    [].concat(unformatted);

            // Run the highlighted results through the configured formatter (if
            // any) to produce the final formatted results.
            if (formatter) {
                formatted = formatter(query, raw, formatted, unformatted);
            }

            // Finally, unroll all the result arrays into a single array of
            // result objects.
            len = maxResults > 0 ? Math.min(maxResults, formatted.length) :
                    formatted.length;

            for (i = 0; i < len; ++i) {
                results[i] = {
                    display: formatted[i],
                    raw    : raw[i],
                    text   : unformatted[i]
                };
            }

            facade.results = results;
        }

        this.fire(EVT_RESULTS, facade);
    },

    /**
     * <p>
     * Returns the query portion of the specified input value, or
     * <code>null</code> if there is no suitable query within the input value.
     * </p>
     *
     * <p>
     * If a query delimiter is defined, the query will be the last delimited
     * part of of the string.
     * </p>
     *
     * @method _parseValue
     * @param {String} value Input value from which to extract the query.
     * @return {String|null} query
     * @protected
     */
    _parseValue: function (value) {
        var delim = this.get(QUERY_DELIMITER);

        if (delim) {
            value = value.split(delim);
            value = value[value.length - 1];
        }

        return this._trimLeft(value);
    },

    /**
     * Setter for locator attributes.
     *
     * @method _setLocator
     * @param {Function|String|null} locator
     * @return {Function|null}
     * @protected
     */
    _setLocator: function (locator) {
        if (this[_FUNCTION_VALIDATOR](locator)) {
            return locator;
        }

        var that = this;

        locator = locator.toString().split('.');

        return function (result) {
            return result && that._getObjectValue(result, locator);
        };
    },

    /**
     * Setter for the <code>requestTemplate</code> attribute.
     *
     * @method _setRequestTemplate
     * @param {Function|String|null} template
     * @return {Function|null}
     * @protected
     */
    _setRequestTemplate: function (template) {
        if (this[_FUNCTION_VALIDATOR](template)) {
            return template;
        }

        template = template.toString();

        return function (query) {
            return Lang.sub(template, {query: encodeURIComponent(query)});
        };
    },

    /**
     * Setter for the <code>source</code> attribute. Returns a DataSource or
     * a DataSource-like function depending on the type of <i>source</i>.
     *
     * @method _setSource
     * @param {Array|DataSource|Object|String} source AutoComplete source. See
     *   the <code>source</code> attribute for details.
     * @return {DataSource|Function}
     * @protected
     */
    _setSource: function (source) {
        if ((source && isFunction(source.sendRequest)) || source === null) {
            // Quacks like a DataSource instance (or null). Make it so!
            return source;

        } else if (typeof source === 'string') {
            // Assume the string is a JSONP URL or a YQL query.
            return this._createStringSource(source);

        } else if (isArray(source)) {
            // Wrap the array in a teensy tiny fake DataSource that just returns
            // the array itself for each request. Filters will do the rest.
            return this._createArraySource(source);

        } else if (isObject(source)) {
            // Wrap the object in a teensy tiny fake DataSource that looks for
            // the request as a property on the object and returns it if it
            // exists, or an empty array otherwise.
            return this._createObjectSource(source);

        } else if (Y.JSONPRequest && source instanceof Y.JSONPRequest) {
            return this._createJSONPSource(source);
        }

        return INVALID_VALUE;
    },

    /**
     * Shared success callback for non-DataSource sources.
     *
     * @method _sourceSuccess
     * @param {mixed} data Response data.
     * @param {Object} request Request object.
     * @protected
     */
    _sourceSuccess: function (data, request) {
        request.callback.success({
            data: data,
            response: {results: data}
        });
    },

    /**
     * Utility function to trim whitespace from the left side of a string.
     *
     * @method _trimLeft
     * @param {String} string String to trim.
     * @return {String} Trimmed string.
     * @protected
     */
    _trimLeft: String.prototype.trimLeft ? function (string) {
        return string.trimLeft();
    } : function (string) {
        return string.replace(/^\s+/, '');
    },

    /**
     * <p>
     * Updates the query portion of the <code>value</code> attribute.
     * </p>
     *
     * <p>
     * If a query delimiter is defined, the last delimited portion of the input
     * value will be replaced with the specified <i>value</i>.
     * </p>
     *
     * @method _updateValue
     * @param {String} newVal New value.
     * @protected
     */
    _updateValue: function (newVal) {
        var delim = this.get(QUERY_DELIMITER),
            insertDelim,
            len,
            prevVal;

        newVal = this._trimLeft(newVal);

        if (delim) {
            insertDelim = trim(delim); // so we don't double up on spaces
            prevVal     = YArray.map(trim(this.get(VALUE)).split(delim), trim);
            len         = prevVal.length;

            if (len > 1) {
                prevVal[len - 1] = newVal;
                newVal = prevVal.join(insertDelim + ' ');
            }

            newVal = newVal + insertDelim + ' ';
        }

        this.set(VALUE, newVal);
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
     * Handles change events for the <code>value</code> attribute.
     *
     * @method _afterValueChange
     * @param {EventFacade} e
     * @protected
     */
    _afterValueChange: function (e) {
        var delay,
            fire,
            newVal = e.newVal,
            query,
            that;

        // Don't query on value changes that didn't come from the user.
        if (e.src !== AutoCompleteBase.UI_SRC) {
            this._inputNode.set(VALUE, newVal);
            return;
        }


        query = this._parseValue(newVal);

        if (query && query.length >= this.get('minQueryLength')) {
            delay = this.get('queryDelay');
            that  = this;

            fire = function () {
                that.fire(EVT_QUERY, {
                    inputValue: newVal,
                    query     : query
                });
            };

            if (delay) {
                clearTimeout(this._delay);
                this._delay = setTimeout(fire, delay);
            } else {
                fire();
            }
        } else {
            clearTimeout(this._delay);
            this.fire(EVT_CLEAR);
        }
    },

    /**
     * Handles <code>valueChange</code> events on the input node and fires a
     * <code>query</code> event when the input value meets the configured
     * criteria.
     *
     * @method _onInputValueChange
     * @param {EventFacade} e
     * @protected
     */
    _onInputValueChange: function (e) {
        var newVal = e.newVal;

        // Don't query if the internal value is the same as the new value
        // reported by valueChange.
        if (newVal === this.get(VALUE)) {
            return;
        }

        this.set(VALUE, newVal, {src: AutoCompleteBase.UI_SRC});
    },

    /**
     * Handles DataSource responses and fires the <code>results</code> event.
     *
     * @method _onResponse
     * @param {EventFacade} e
     * @protected
     */
    _onResponse: function (query, e) {
        // Ignore stale responses that aren't for the current query.
        if (query && query === this.get(QUERY)) {
            this._parseResponse(query, e.response, e.data);
        }
    },

    // -- Protected Default Event Handlers -------------------------------------

    /**
     * Default <code>clear</code> event handler. Sets the <code>results</code>
     * property to an empty array and <code>query</code> to null.
     *
     * @method _defClearFn
     * @protected
     */
    _defClearFn: function () {
        this._set(QUERY, null);
        this._set(RESULTS, []);
    },

    /**
     * Default <code>query</code> event handler. Sets the <code>query</code>
     * property and sends a request to the DataSource if one is configured.
     *
     * @method _defQueryFn
     * @param {EventFacade} e
     * @protected
     */
    _defQueryFn: function (e) {
        var query = e.query,
            request,
            requestTemplate,
            source = this.get('source');

        this._set(QUERY, query);


        if (query && source) {
            requestTemplate = this.get(REQUEST_TEMPLATE);
            request         = requestTemplate ? requestTemplate(query) : query;


            source.sendRequest({
                request: request,
                callback: {
                    success: Y.bind(this._onResponse, this, query)
                }
            });
        }
    },

    /**
     * Default <code>results</code> event handler. Sets the <code>results</code>
     * and <code>resultsRaw</code> properties to the latest results.
     *
     * @method _defResultsFn
     * @param {EventFacade} e
     * @protected
     */
    _defResultsFn: function (e) {
        this._set(RESULTS, e[RESULTS]);
    }
};

Y.AutoCompleteBase = AutoCompleteBase;


}, '@VERSION@' ,{requires:['array-extras', 'base-build', 'event-valuechange', 'node-base'], optional:['jsonp', 'yql']});
YUI.add('autocomplete-list', function(Y) {

/**
 * Traditional autocomplete dropdown list widget, just like Mom used to make.
 *
 * @module autocomplete
 * @submodule autocomplete-list
 * @class AutoCompleteList
 * @extends Widget
 * @uses AutoCompleteBase
 * @uses WidgetPosition
 * @uses WidgetPositionAlign
 * @uses WidgetStack
 * @constructor
 * @param {Object} config Configuration object.
 */

var Node   = Y.Node,
    YArray = Y.Array,

    // keyCode constants.
    KEY_DOWN  = 40,
    KEY_ENTER = 13,
    KEY_ESC   = 27,
    KEY_TAB   = 9,
    KEY_UP    = 38,

    // String shorthand.
    _CLASS_ITEM        = '_CLASS_ITEM',
    _CLASS_ITEM_ACTIVE = '_CLASS_ITEM_ACTIVE',
    _CLASS_ITEM_HOVER  = '_CLASS_ITEM_HOVER',
    _SELECTOR_ITEM     = '_SELECTOR_ITEM',

    ACTIVE_ITEM      = 'activeItem',
    ALWAYS_SHOW_LIST = 'alwaysShowList',
    CIRCULAR         = 'circular',
    HOVERED_ITEM     = 'hoveredItem',
    ID               = 'id',
    ITEM             = 'item',
    LIST             = 'list',
    RESULT           = 'result',
    RESULTS          = 'results',
    VISIBLE          = 'visible',
    WIDTH            = 'width',

    // Event names.
    EVT_SELECT = 'select',

List = Y.Base.create('autocompleteList', Y.Widget, [
    Y.AutoCompleteBase,
    Y.WidgetPosition,
    Y.WidgetPositionAlign,
    Y.WidgetStack
], {
    // -- Prototype Properties -------------------------------------------------
    ITEM_TEMPLATE: '<li/>',
    LIST_TEMPLATE: '<ul/>',

    // -- Lifecycle Prototype Methods ------------------------------------------
    initializer: function () {
        /**
         * Fires when an autocomplete suggestion is selected from the list by
         * a keyboard action or mouse click.
         *
         * @event select
         * @param {EventFacade} e Event facade with the following additional
         *   properties:
         *
         * <dl>
         *   <dt>itemNode (Node)</dt>
         *   <dd>
         *     List item node that was selected.
         *   </dd>
         *
         *   <dt>result (Object)</dt>
         *   <dd>
         *     AutoComplete result object.
         *   </dd>
         * </dl>
         *
         * @preventable _defResultsFn
         */
        this.publish(EVT_SELECT, {
            defaultFn: this._defSelectFn
        });

        this._events    = [];
        this._inputNode = this.get('inputNode');

        // Cache commonly used classnames and selectors for performance.
        this[_CLASS_ITEM]        = this.getClassName(ITEM);
        this[_CLASS_ITEM_ACTIVE] = this.getClassName(ITEM, 'active');
        this[_CLASS_ITEM_HOVER]  = this.getClassName(ITEM, 'hover');
        this[_SELECTOR_ITEM]     = '.' + this[_CLASS_ITEM];

        if (!this._inputNode) {
            Y.error('No inputNode specified.');
        }

        if (!this.get('align.node')) {
            this.set('align.node', this._inputNode);
        }

        if (!this.get(WIDTH)) {
            this.set(WIDTH, this._inputNode.get('offsetWidth'));
        }
    },

    destructor: function () {
        this.unbindInput();

        while (this._events.length) {
            this._events.pop().detach();
        }
    },

    bindUI: function () {
        this._bindInput();
        this._bindList();
    },

    renderUI: function () {
        var contentBox = this.get('contentBox'),
            listNode   = this.get('listNode');

        // See http://www.w3.org/WAI/PF/aria/roles#combobox for ARIA details.
        if (!listNode) {
            listNode = Node.create(this.LIST_TEMPLATE);

            listNode.addClass(this.getClassName(LIST)).setAttrs({
                id  : Y.stamp(listNode),
                role: 'listbox'
            });

            contentBox.append(listNode);
        }

        this._inputNode.addClass(this.getClassName('input')).setAttrs({
            'aria-autocomplete': LIST,
            'aria-live': 'polite', // causes the screen reader to announce the value of an item when selected
            'aria-owns': listNode.get(ID),
            role: 'combobox'
        });

        if (this.get(ALWAYS_SHOW_LIST)) {
            this.set(VISIBLE, true);
        }

        this._contentBox = contentBox;
        this._listNode   = listNode;
    },

    syncUI: function () {
        this.syncInput();
        this._syncResults();
        this._syncVisibility();
    },

    // -- Public Prototype Methods ---------------------------------------------

    /**
     * Hides the list, unless the <code>alwaysShowList</code> attribute is
     * <code>true</code>.
     *
     * @method hide
     * @see show
     * @chainable
     */
    hide: function () {
        return this.get(ALWAYS_SHOW_LIST) ? this : this.set(VISIBLE, false);
    },

    /**
     * Selects the specified <i>itemNode</i>, or the current
     * <code>activeItem</code> if <i>itemNode</i> is not specified.
     *
     * @method selectItem
     * @param {Node} itemNode (optional) Item node to select.
     * @chainable
     */
    selectItem: function (itemNode) {
        if (itemNode) {
            if (!itemNode.hasClass(this[_CLASS_ITEM])) {
                return;
            }
        } else {
            itemNode = this.get(ACTIVE_ITEM);

            if (!itemNode) {
                return;
            }
        }

        this.fire(EVT_SELECT, {
            itemNode: itemNode,
            result  : itemNode.getData(RESULT)
        });

        return this;
    },

    /**
     * Shows the list.
     *
     * @method show
     * @see hide
     * @chainable
     */
    show: function () {
        return this.set(VISIBLE, true);
    },

    // -- Protected Prototype Methods ------------------------------------------

    /**
     * Activates the next item after the currently active item. If there is no
     * next item and the <code>circular</code> attribute is <code>true</code>,
     * the first item in the list will be activated.
     *
     * @method _activateNextItem
     * @protected
     */
    _activateNextItem: function () {
        var item = this.get(ACTIVE_ITEM),
            nextItem;

        nextItem = (item && item.next(this[_SELECTOR_ITEM])) ||
                this.get(CIRCULAR) && this._getFirstItemNode();

        if (nextItem) {
            this._set(ACTIVE_ITEM, nextItem);
        }

        return this;
    },

    /**
     * Activates the item previous to the currently active item. If there is no
     * previous item and the <code>circular</code> attribute is
     * <code>true</code>, the last item in the list will be activated.
     *
     * @method _activatePrevItem
     * @protected
     */
    _activatePrevItem: function () {
        var item     = this.get(ACTIVE_ITEM),
            prevItem;

        prevItem = (item && item.previous(this[_SELECTOR_ITEM])) ||
                this.get(CIRCULAR) && this._getLastItemNode();

        if (prevItem) {
            this._set(ACTIVE_ITEM, prevItem);
        }

        return this;
    },

    /**
     * Appends the specified result <i>items</i> to the list inside a new item
     * node.
     *
     * @method _add
     * @param {Array|Node|HTMLElement|String} items Result item or array of
     *   result items.
     * @return {NodeList} Added nodes.
     * @protected
     */
    _add: function (items) {
        var itemNodes = [];

        YArray.each(Y.Lang.isArray(items) ? items : [items], function (item) {
            itemNodes.push(this._createItemNode(item).setData(RESULT, item));
        }, this);

        itemNodes = Y.all(itemNodes);
        this._listNode.append(itemNodes.toFrag());

        return itemNodes;
    },

    /**
     * Binds <code>inputNode</code> events, in addition to those already bound
     * by <code>AutoCompleteBase</code>'s public <code>bindInput()</code>
     * method.
     *
     * @method _bindInput
     * @protected
     */
    _bindInput: function () {
        var inputNode = this._inputNode;

        // Call AutoCompleteBase's bind method first.
        this.bindInput();

        this._events.concat([
            inputNode.on('blur', this._onInputBlur, this),
            inputNode.on(Y.UA.gecko ? 'keypress' : 'keydown', this._onInputKey, this)
        ]);
    },

    /**
     * Binds list events.
     *
     * @method _bindList
     * @protected
     */
    _bindList: function () {
        this._events.concat([
            this.after('mouseover', this._afterMouseOver),
            this.after('mouseout', this._afterMouseOut),

            this.after('activeItemChange', this._afterActiveItemChange),
            this.after('alwaysShowListChange', this._afterAlwaysShowListChange),
            this.after('hoveredItemChange', this._afterHoveredItemChange),
            this.after('resultsChange', this._afterResultsChange),
            this.after('visibleChange', this._afterVisibleChange),

            this._listNode.delegate('click', this._onItemClick, this[_SELECTOR_ITEM], this)
        ]);
    },

    /**
     * Clears the contents of the tray.
     *
     * @method _clear
     * @protected
     */
    _clear: function () {
        this._set(ACTIVE_ITEM, null);
        this._set(HOVERED_ITEM, null);

        this._listNode.get('children').remove(true);
    },

    /**
     * Creates an item node with the specified <i>content</i>.
     *
     * @method _createItemNode
     * @param {Object} result Result object.
     * @protected
     * @return {Node} Item node.
     */
    _createItemNode: function (result) {
        var itemNode = Node.create(this.ITEM_TEMPLATE);

        return itemNode.addClass(this[_CLASS_ITEM]).setAttrs({
            id  : Y.stamp(itemNode),
            role: 'option'
        }).append(result.display);
    },

    /**
     * Gets the last item node in the list, or <code>null</code> if the list is
     * empty.
     *
     * @method _getLastItemNode
     * @return {Node|null}
     * @protected
     */
    _getLastItemNode: function () {
        return this._listNode.one(this[_SELECTOR_ITEM] + ':last-child');
    },

    /**
     * Gets the first item node in the list, or <code>null</code> if the list is
     * empty.
     *
     * @method _getFirstItemNode
     * @return {Node|null}
     * @protected
     */
    _getFirstItemNode: function () {
        return this._listNode.one(this[_SELECTOR_ITEM]);
    },

    /**
     * Synchronizes the results displayed in the list with those in the
     * <i>results</i> argument, or with the <code>results</code> attribute if an
     * argument is not provided.
     *
     * @method _syncResults
     * @param {Array} results (optional) Results.
     * @protected
     */
    _syncResults: function (results) {
        var items;

        if (!results) {
            results = this.get(RESULTS);
        }

        this._clear();

        if (results.length) {
            items = this._add(results);
        }

        if (this.get('activateFirstItem') && !this.get(ACTIVE_ITEM)) {
            this._set(ACTIVE_ITEM, this._getFirstItemNode());
        }
    },

    /**
     * Synchronizes the visibility of the tray with the <i>visible</i> argument,
     * or with the <code>visible</code> attribute if an argument is not
     * provided.
     *
     * @method _syncVisibility
     * @param {Boolean} visible (optional) Visibility.
     * @protected
     */
    _syncVisibility: function (visible) {
        if (typeof visible === 'undefined') {
            visible = this.get(VISIBLE);
        }

        this._contentBox.set('aria-hidden', !visible);

        if (!visible) {
            this._set(ACTIVE_ITEM, null);
            this._set(HOVERED_ITEM, null);
        }
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
     * Handles <code>activeItemChange</code> events.
     *
     * @method _afterActiveItemChange
     * @param {EventTarget} e
     * @protected
     */
    _afterActiveItemChange: function (e) {
        var newVal  = e.newVal,
            prevVal = e.prevVal;

        if (prevVal) {
            prevVal.removeClass(this[_CLASS_ITEM_ACTIVE]);
        }

        if (newVal) {
            newVal.addClass(this[_CLASS_ITEM_ACTIVE]);
            this._inputNode.set('aria-activedescendant', newVal.get(ID));
        }
    },

    /**
     * Handles <code>alwaysShowListChange</code> events.
     *
     * @method _afterAlwaysShowListChange
     * @param {EventTarget} e
     * @protected
     */
    _afterAlwaysShowListChange: function (e) {
        this.set(VISIBLE, e.newVal || this.get(RESULTS).length > 0);
    },

    /**
     * Handles <code>hoveredItemChange</code> events.
     *
     * @method _afterHoveredItemChange
     * @param {EventTarget} e
     * @protected
     */
    _afterHoveredItemChange: function (e) {
        var newVal  = e.newVal,
            prevVal = e.prevVal;

        if (prevVal) {
            prevVal.removeClass(this[_CLASS_ITEM_HOVER]);
        }

        if (newVal) {
            newVal.addClass(this[_CLASS_ITEM_HOVER]);
        }
    },

    /**
     * Handles <code>mouseover</code> events.
     *
     * @method _afterMouseOver
     * @param {EventTarget} e
     * @protected
     */
    _afterMouseOver: function (e) {
        var itemNode = e.domEvent.target.ancestor(this[_SELECTOR_ITEM], true);

        this._mouseOverList = true;

        if (itemNode) {
            this._set(HOVERED_ITEM, itemNode);
        }
    },

    /**
     * Handles <code>mouseout</code> events.
     *
     * @method _afterMouseOut
     * @param {EventTarget} e
     * @protected
     */
    _afterMouseOut: function () {
        this._mouseOverList = false;
        this._set(HOVERED_ITEM, null);
    },

    /**
     * Handles <code>resultsChange</code> events.
     *
     * @method _afterResultsChange
     * @param {EventFacade} e
     * @protected
     */
    _afterResultsChange: function (e) {
        this._syncResults(e.newVal);

        if (!this.get(ALWAYS_SHOW_LIST)) {
            this.set(VISIBLE, !!e.newVal.length);
        }
    },

    /**
     * Handles <code>visibleChange</code> events.
     *
     * @method _afterVisibleChange
     * @param {EventFacade} e
     * @protected
     */
    _afterVisibleChange: function (e) {
        this._syncVisibility(!!e.newVal);
    },

    /**
     * Handles <code>inputNode</code> <code>blur</code> events.
     *
     * @method _onInputBlur
     * @param {EventTarget} e
     * @protected
     */
    _onInputBlur: function (e) {
        // Hide the list on inputNode blur events, unless the mouse is currently
        // over the list (which indicates that the user is probably interacting
        // with it) or the tab key was pressed.
        if (this._mouseOverList && this._lastInputKey !== KEY_TAB) {
            this._inputNode.focus();
        } else {
            this.hide();
        }
    },

    /**
     * Handles <code>inputNode</code> key events.
     *
     * @method _onInputKey
     * @param {EventTarget} e
     * @protected
     */
    _onInputKey: function (e) {
        var action,
            keyCode = e.keyCode,
            visible;

        this._lastInputKey = keyCode;

        if (!this.get(RESULTS).length) {
            return;
        }

        visible = this.get(VISIBLE);

        if (keyCode === KEY_DOWN) {
            action = 1;

            if (!visible) {
                this.show();
            }

            this._activateNextItem();
        }

        if (visible) {
            switch (keyCode) {
            case KEY_ENTER:
                action = 1;
                this.selectItem();
                break;

            case KEY_ESC:
                action = 1;
                this.hide();
                break;

            case KEY_TAB:
                if (this.get('tabSelect')) {
                    action = 1;
                    this.selectItem();
                }
                break;

            case KEY_UP:
                action = 1;
                this._activatePrevItem();
                break;
            }
        }

        if (action) {
            e.preventDefault();
        }
    },

    /**
     * Delegated event handler for item <code>click</code> events.
     *
     * @method _onItemClick
     * @param {EventTarget} e
     * @protected
     */
    _onItemClick: function (e) {
        var itemNode = e.currentTarget;

        e.preventDefault();

        this._set(ACTIVE_ITEM, itemNode);
        this.selectItem(itemNode);
    },

    // -- Protected Default Event Handlers -------------------------------------

    /**
     * Default <code>select</code> event handler.
     *
     * @method _defSelectFn
     * @param {EventTarget} e
     * @protected
     */
    _defSelectFn: function (e) {
        // TODO: support typeahead completion, etc.
        this._inputNode.focus();
        this._updateValue(e.result.text);
        this.hide();
    }
}, {
    ATTRS: {
        /**
         * If <code>true</code>, the first item in the list will be activated by
         * default when the list is initially displayed and when results change.
         *
         * @attribute activateFirstItem
         * @type Boolean
         * @default false
         */
        activateFirstItem: {
            value: false
        },

        /**
         * Item that's currently active, if any. When the user presses enter,
         * this is the item that will be selected.
         *
         * @attribute activeItem
         * @type Node
         * @readonly
         */
        activeItem: {
            readOnly: true,
            value: null
        },

        // The "align" attribute is documented in WidgetPositionAlign.
        align: {
            value: {
                points: ['tl', 'bl']
            }
        },

        /**
         * If <code>true</code>, the list will remain visible even when there
         * are no results to display.
         *
         * @attribute alwaysShowList
         * @type Boolean
         * @default false
         */
        alwaysShowList: {
            value: false
        },

        /**
         * If <code>true</code>, keyboard navigation will wrap around to the
         * opposite end of the list when navigating past the first or last item.
         *
         * @attribute circular
         * @type Boolean
         * @default true
         */
        circular: {
            value: true
        },

        /**
         * Item currently being hovered over by the mouse, if any.
         *
         * @attribute hoveredItem
         * @type Node|null
         * @readonly
         */
        hoveredItem: {
            readOnly: true,
            value: null
        },

        /**
         * If <code>true</code>, pressing the tab key while the list is visible
         * will select the active item, if any.
         *
         * @attribute tabSelect
         * @type Boolean
         * @default true
         */
        tabSelect: {
            value: true
        },

        // The "visible" attribute is documented in Widget.
        visible: {
            value: false
        }
    },

    CSS_PREFIX: Y.ClassNameManager.getClassName('aclist'),

    HTML_PARSER: {
        /**
         * Node that will contain result items.
         *
         * @attribute listNode
         * @type Node|null
         * @readonly
         */
        listNode: function () {
            return this.getClassName(LIST);
        }
    }
});

Y.AutoCompleteList = List;

/**
 * Alias for <a href="AutoCompleteList.html"><code>AutoCompleteList</code></a>.
 * See that class for API docs.
 *
 * @class AutoComplete
 */

Y.AutoComplete = List;


}, '@VERSION@' ,{requires:['autocomplete-base', 'widget', 'widget-position', 'widget-position-align', 'widget-stack'], skinnable:true});


YUI.add('autocomplete', function(Y){}, '@VERSION@' ,{use:['autocomplete-base', 'autocomplete-list']});

