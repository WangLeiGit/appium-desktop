import Bluebird from 'bluebird';

export default class AppiumMethodHandler {
  constructor (driver) {
    this.driver = driver;
    this.elementCache = {};
    this.elVariableCounter = 1;
    this.elArrayVariableCounter = 1;
  }

  async fetchElement (strategy, selector) {
    let element = await this.driver.elementOrNull(strategy, selector);
    if (element === null) {
      return {};
    }
    let id = element.value;

    // Cache this ID along with it's variable name, variable type and strategy/selector
    let cachedEl = this.elementCache[id] = {
      el: element,
      variableType: 'string',
      strategy,
      selector,
      id,
    };

    return {
      ...cachedEl,
      strategy,
      selector,
      id,
    };
  }

  async fetchElements (strategy, selector) {
    let els = await this.driver.elements(strategy, selector);

    let variableName = `els${this.elArrayVariableCounter++}`;
    let variableType = 'array';

    // Cache the elements that we find
    let elements = els.map((el, index) => {
      const res = {
        el,
        variableName,
        variableIndex: index,
        variableType: 'string',
        id: el.value,
        strategy,
        selector,
      };
      this.elementCache[el.value] = res;
      return res;
    });
    
    return {variableName, variableType, strategy, selector, elements};
  }

  async executeElementCommand (elementId, methodName, args = []) {
    const elCache = this.elementCache[elementId];

    // Give the cached element a variable name (el1, el2, el3,...) the first time it's used
    if (!elCache.variableName && elCache.variableType === 'string') {
      elCache.variableName = `el${this.elVariableCounter++}`;
    }
    const res = await elCache.el[methodName].apply(elCache.el, args);

    // Give the source/screenshot time to change before taking the screenshot
    await Bluebird.delay(500);

    let sourceAndScreenshot = await this._getSourceAndScreenshot();

    return {
      ...sourceAndScreenshot,
      ...elCache,
      res,
    };
  }

  async executeMethod (methodName, args = []) {
    let res = {};
    if (methodName !== 'source' && methodName !== 'screenshot') {
      res = await this.driver[methodName].apply(this.driver, args);
    }

    // Give the source/screenshot time to change before taking the screenshot
    await Bluebird.delay(500);

    let sourceAndScreenshot = await this._getSourceAndScreenshot();

    return {
      ...sourceAndScreenshot,
      res,
    };
  }

  async _getSourceAndScreenshot () {
    let source, sourceError, screenshot, screenshotError;
    try {
      source = await this.driver.source();
    } catch (e) {
      if (e.status === 6) {
        throw e;
      }
      sourceError = e;
    }

    try {
      screenshot = await this.driver.takeScreenshot();
    } catch (e) {
      if (e.status === 6) {
        throw e;
      }
      screenshotError = e;
    }

    return {source, sourceError, screenshot, screenshotError};
  }

  restart () {
    // Clear the variable names and start over (el1, el2, els1, els2, etc...)
    this.elementCache = this.elementCache.map((elCache) => ({
      ...elCache,
      variableName: undefined,
    }));

    // Restart the variable counter
    this.elVariableCounter = 1;
    this.elArrayVariableCounter = 1;   
  }

}