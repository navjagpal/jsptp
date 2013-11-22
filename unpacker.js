/**
 * @fileoverview Description of this file.
 */

goog.provide('ptp');
goog.provide('ptp.Unpacker');

ptp.PtpUnpacker = function(raw) {
  this.raw = raw;
  this.offset = 0;
};

ptp.PtpUnpacker.prototype.unpack_string = function() {
  var dataView = new DataView(this.raw);
  var strLen = dataView.getInt8(0, true);
  this.offset += 1;

  return String.fromCharCode.apply(null,
    new Uint16Array(this.raw.slice(
      this.offset, this.offset + strLen * 2)));
};

PtpUnpacker.prototype.unpack_simpletype = function(
  is_array, fmt) {
  if (!is_array) {
    if (fmt == '_STR') {
      return this.unpack_string();
    }
  }
};
