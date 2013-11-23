/**
 * Common values/constants for PTP.
 */

goog.provide('ptp.Values');

/**
 * Enum for events.
 * @enum {number}
 */
ptp.Values.StandardEvents = {
  OBJECT_ADDED: 0x4002
};

/**
 * Enum for properties.
 * @enum {number}
 */
ptp.Values.StandardProperties = {
  BATTERY_LEVEL: 0x5001,
  DEVICE_FRIENDLY_NAME: 0xD402
};

/**
 * Enum for operations.
 * @enum {number}
 */
ptp.Values.StandardOperations = {
  INITIATE_CAPTURE: 0x100e,
  GET_DEVICE_PROP_VALUE: 0x1015,
  EOS_CAPTURE: 0x910F,
  EOS_SET_PC_CONNECT_MODE: 0x9114,
  OPEN_SESSION: 0x1002,
  CLOSE_SESSION: 0x1003,
  GET_OBJECT: 0x1009,
  GET_OBJECT_INFO: 0x1008
};

/**
 * Enum for object formats.
 * @enum {number}
 */
ptp.Values.StandardObjectFormats = {
  EXIF_JPEG: 0x3801
};

/**
 * Enum for response codes.
 * @enum {number}
 */
ptp.Values.StandardResponses = {
  OK: 0x2001,
  DEVICE_PROP_NOT_SUPPORTED: 0x200a
};

goog.exportSymbol('ptp.Values');
