/**
 * @fileoverview Object info.
 */

<<<<<<< HEAD
goog.provide('ptp.ObjectInfo');
=======
goog.provide('ptp.ObjectInfo'); 
>>>>>>> f1d1217677957a400b2480df057d49899a97d2b2

/**
 * Represents object information.
 * @param {ArrayBuffer} buffer Raw byte array.
<<<<<<< HEAD
 * @constructor
=======
>>>>>>> f1d1217677957a400b2480df057d49899a97d2b2
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
