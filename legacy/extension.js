const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Me = ExtensionUtils.getCurrentExtension();
const { Indicator } = Me.imports.lib.indicator;

let _indicator = null;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    _indicator = new Indicator(Me);
    Main.panel.addToStatusArea(Me.metadata.uuid, _indicator);
}

function disable() {
    if (_indicator) {
        _indicator.destroy();
        _indicator = null;
    }
}
