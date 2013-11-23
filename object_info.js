/**
 * @fileoverview Object info.
 */

goog.provide('ptp.ObjectInfo');

/**
 * Represents object information.
 * @param {ArrayBuffer} buffer Raw byte array.
 * @constructor
 */
ptp.ObjectInfo = function(buffer) {
  // TODO(nav): There are a bunch of fields here.
  var dataView = new DataView(buffer);
  this.StorageId = dataView.getUint32(0, true);
  this.ObjectFormat = dataView.getUint16(4, true);
  this.ProtectionStatus = dataView.getUint16(6, true);
  this.ObjectCompressedSize = dataView.getUint32(8, true);
};

goog.exportSymbol('ptp.ObjectInfo');
