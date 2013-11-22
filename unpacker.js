/**
 * @fileoverview Classes related to unpacking byte data.
 */

goog.provide('ptp.Unpacker');

/**
 * Unpacks raw byte data from responses into the appropriate JS data types.
 * @param {ArrayBuffer} buffer The raw byte data to unpack.
 * @constructor
 */
ptp.Unpacker = function(buffer) {
  /**
   * Raw byte array.
   * @type ArrayBuffer
   * @private
   */
  this.buffer_ = buffer;

  /**
   * Current position within the buffer.
   * @type Number
   * @private
   */
  this.offset_ = 0;
};

/**
 * Unpacks a String from the current offset.
 * @return {String} The unpacked string.
 * @private
 */
ptp.Unpacker.prototype.unpackString_ = function() {
  var dataView = new DataView(this.buffer_);
  var strLen = dataView.getInt8(0, true);
  this.offset_ += 1;

  return String.fromCharCode.apply(null,
    new Uint16Array(this.buffer_.slice(
      this.offset_, this.offset_ + strLen * 2)));
};

/**
 * Convenience method to unpack common types using format strings.
 * @param {bool} isArray Whether or not the return value is an array.
 * @param {String} fmt Format string describing the data to unpack.
 * @return {Object} The unpacked data.
 */
Unpacker.prototype.unpackSimpletype = function(
  isArray, fmt) {
  if (!isArray) {
    if (fmt == '_STR') {
      return this.unpackString_();
    }
  }
};
