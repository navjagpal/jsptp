
var VENDOR_ID = 1193;
var PRODUCT_ID = 12613;

var transfer = {
  direction: 'in',
  endpoint: 1,
  length: 6
}

var transport = null;
var session = null;
var camera = null;

var liveView = false;

var testCounts = 0;

var USB_PTP_CLASS = 6;

var writableDirectory = null;

var images = [];

function test2() {
  session.SetPCConnectMode(1, function(result) {
    console.log('Pc connect mode accepted ' + result);
    session.SetEventMode(1, function(result) {
   //   console.log('EventMode accepted: ' + result);
    //    session.SetOutputValue(0, function(result) {
          console.log('SetOutputValue: ' + result);
       //   session.SetCaptureDestination(1, function(result) {
      //      console.log('Capture dest: ' + result);
      //    });
   //     });
    });
  }); 
}

function setupLive() {
  session.SetPCConnectMode(1, function(result) {
    session.SetEventMode(1, function(result) {
      session.SetCaptureDestination(1, function(result) {
        session.SetOutputValue(2, function(result) {
        });
      });
    });
  });
};

var setupCount = 0;
function setupCapture() {
  console.log('SetupCount = ' + setupCount);
  if (setupCount == 0) {
    session.SetPCConnectMode(1, function(result) {
      session.SetEventMode(1, function(result) {
        console.log('Event mode set');
      });
    });
  } else if (setupCount == 1) {
    session.SetCaptureDestination(2, function(result) {
      console.log('SEt output value');
        session.GetRemoteMode(function() {});
    });
    /*session.SetCaptureDestination(1, function(result) {
      if (!result) {
        console.log('Cannot set capture');
        return;
      }
       console.log('Capture set');
    });*/
  }

  setupCount += 1;
};

function test() {
  if (testCounts == 0) {
    session.SetPCConnectMode(1, function(result) {
      if (!result) {
        console.log('PCmode failed');
        return;
      }
      session.SetEventMode(1, function(result) {
        if (!result) {
          console.log('Set eventmode failed');
          return;
        }
        // Get some event data
      });
    });
    testCounts += 1;
  } else if (testCounts == 1) {
    session.SetCaptureDestination(1, function(result) {
      if (!result) {
        console.log('Cannot set capture');
        return;
      }
       console.log('Capture set');
    });
  }
}

function check() {
  console.log('Checking for EOS event');
  session.CheckForEOSEvent(function(evt) {
    console.log('Event: ' + evt);
    if (evt.byteLength) {
      camera.parseCanonData(evt, function(data) {
        displayData(data);
        savePhotoToFile(data);
      });
    }
  });
}

function GetNextFilename() {
  return 'image' + images.length + '.jpg';
}

function onDeviceFound(devices) {
  if (!devices) {
    return;
  }
  for (var i = 0; i < devices.length; i++) {
    var device = devices[i];
    chrome.usb.listInterfaces(device, function(descriptors) {
      for (var i = 0; descriptors && i < descriptors.length; i++) {
        var descriptor = descriptors[i];
        console.log('Descriptor: ' + JSON.stringify(descriptor));
        if (descriptor.interfaceClass == USB_PTP_CLASS) {
          chrome.usb.claimInterface(device, descriptor.interfaceNumber, function() {
            console.log('Interface is claimed!');
            transport = new ptp.Transport(device, descriptor);
            session = new ptp.Session(transport);
            session.OpenSession(function(result) {
              console.log('Session opened?: ' + result);
              if (result) {
                camera = new ptp.CanonCamera(session);
              }
            }); 
          });
        }
      }
    });
  }
}

function onPermissionRequest(result) {
  if (result) {
    console.log('Permission granted');
    chrome.usb.findDevices({vendorId: VENDOR_ID, productId: PRODUCT_ID}, onDeviceFound);
  } else {
    console.log('Permission denied');
  }
}

function lookupDevices() {
  console.log('Looking for devices')
  chrome.permissions.request(
    {permissions: [
      {usbDevices: [{vendorId: VENDOR_ID, productId: PRODUCT_ID}]}]}, onPermissionRequest);
}

function displayImage(filename) {
  writableDirectory.getFile(filename, {create: false}, function(entry) {
    entry.file(function(file) {
      var reader = new FileReader();
      reader.onloadend = function(e) {
        var img = document.createElement('img');
        img.src = e.target.result;
        document.body.appendChild(img);
      };
      reader.readAsDataURL(file);
    }); 
  });
};

function displayData(data) {
  console.log('Display photo');
  var binary = '';
  var bytes = new Uint8Array(data);
  for (var i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  console.log('Building b64');
  var b64 = btoa(binary);
  var uri = 'data:image/jpeg;base64,' + b64;
  console.log('uri:' + uri);
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  var img = new Image();
  img.src = uri;
  img.onload = function() {
    context.drawImage(img, 0, 0, 800, 600);
  };
};

function savePhotoToFile(data) {
  chrome.fileSystem.getWritableEntry(writableDirectory, function(writableFileEntry) {
    console.log('Have writable entry.');
    var filename = GetNextFilename();
    writableFileEntry.getFile(filename, {create: true}, function(entry) {
      entry.createWriter(function(writer) {
        console.log('Have writer');
        writer.onwriteend = function(e) {
          console.log('write complete:');
          images.push(filename);
          callback(filename);
        };
        writer.write(new Blob([data], {type: 'image/jpg'}));
      });
    });
  });
};

function extractPhotosFromStream(buffer, callback) {
  var dataView = new DataView(buffer);
  var pos = 0;
  while (pos < buffer.byteLength) {
    console.log('Reading a photo from stream');
    var dataSize = dataView.getUint32(pos, true);
    var dataType = dataView.getUint32(pos + 4, true);
    if (dataType != 1) {
      return;
    }
    callback(buffer.slice(pos + 8, pos + dataSize - 8));
    pos += dataSize;
  }
};

function liveBackup() {
  session.SetPCConnectMode(1, function(result) {
    if (result) {
      console.log('Pc connect mode accepted ' + result);
      session.SetEventMode(1, function(result) {
        console.log('Event mode accepted ' + result);
        session.LiveView(function(result) {
          console.log('Capture initiated?: ' + result);
          if (result) {
            chrome.fileSystem.getWritableEntry(writableDirectory, function(writableFileEntry) {
              console.log('Have writable entry.');
              var filename = GetNextFilename();
              writableFileEntry.getFile(filename, {create: true}, function(entry) {
                entry.createWriter(function(writer) {
                  console.log('Have writer');
                  writer.onwriteend = function(e) {
                    console.log('write complete:');
                    images.push(filename);
                    callback(filename);
                  };
                  writer.write(new Blob([result], {type: 'image/jpg'}));
                });
              });
            });
          } else {
            //if (callback) {
            //  callback(null);
            //}
          }
        });
      });
    } else {
      console.log('No PC mode');
      if (callback) {
        callback(null);
      }
    }
  });
}


function live() {
  session.LiveView(function(result) {
    console.log('Capture initiated?: ' + result);
    if (liveView) {
      setTimeout(live, 100);
    }
    extractPhotosFromStream(result, function(data) {
      displayData(data);
    });
  });
}

function toggleLive() {
  if (liveView) {
    liveView = false;
  } else {
    liveView = true;
    live();
  }
}

function capture(callback) {
  //session.SetCaptureDestination(4, function(result) {
    if (true) {
      console.log('Pc connect mode accepted');
      camera.Capture(function(result) {
        console.log('Capture initiated?: ' + result);
        if (result) {
          chrome.fileSystem.getWritableEntry(writableDirectory, function(writableFileEntry) {
            console.log('Have writable entry.');
            var filename = GetNextFilename();
            writableFileEntry.getFile(filename, {create: true}, function(entry) {
              entry.createWriter(function(writer) {
                console.log('Have writer');
                writer.onwriteend = function(e) {
                  console.log('write complete:');
                  images.push(filename);
                  callback(filename);
                };
                writer.write(new Blob([result], {type: 'image/jpg'}));
              });
            });
          });
        } else {
          //if (callback) {
          //  callback(null);
          //}
        }
      });
    } else {
      console.log('No PC mode');
      if (callback) {
        callback(null);
      }
    }
  //});
}

function render() {
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  for (var i = 0; i < images.length; i++) {
    var x;
    var y;
    if (i % 2 == 0) {
      x = 0;
    } else {
      x = 400;
    }
    if (i < 2) {
      y = 0;
    } else {
      y = 300;
    }
    writableDirectory.getFile(images[i], {create: false},
      (function(x, y) { return function(entry) {
      entry.file(function(file) {
        var reader = new FileReader();
        reader.onloadend = function(e) {
          var img = new Image();
          img.onload = function() {
            console.log('x, y' + x + ',' + y);
            context.drawImage(img, x, y, 400, 300);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      })
      } })(x, y)); 
   
  }
}

function name() {
  console.log('Name button clicked');
  session.GetDeviceFriendlyName(function(result) {
    console.log('Name:' + result);
  });
}

function start() {
  var counterInfo = {counter: 5, pics: 4};
  var counterDisplay = function() {
    var countdown = document.getElementById('countdown');
    while (countdown.firstChild) {
      countdown.removeChild(countdown.firstChild);
    }
    if (counterInfo.counter < 0) {
      // Take a picture. Display it for a couple of seconds, then keep going.
      capture(function(filename) {
        counterInfo.counter = 5;
        counterInfo.pics--;
        if (counterInfo.pics == 0) {
          console.log('No more pics, rendering image');
          render();
        } else {
          console.log('Still have more pics : ' + counterInfo.pics);
          setTimeout(counterDisplay, 1000);
        }
      });
    } else {
      countdown.appendChild(document.createTextNode(counterInfo.counter));
      counterInfo.counter--;
      setTimeout(counterDisplay, 1000);
    }
  };
  setTimeout(counterDisplay, 1000);
}

function selectDirectory() {
  chrome.fileSystem.chooseEntry({type: "openDirectory"}, function(entry) {
    writableDirectory = entry;
    console.log('Have writable directory');
    chrome.storage.local.set({'chosenDirectory': chrome.fileSystem.retainEntry(entry)});
  });
}

document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("lookup").addEventListener(
    "click", lookupDevices);
  document.getElementById("capture").addEventListener(
    "click", capture);
  document.getElementById("live").addEventListener(
    "click", toggleLive);
  document.getElementById("name").addEventListener(
    "click", name);
  document.getElementById("render").addEventListener(
    "click", render);
  document.getElementById("start").addEventListener(
    "click", start);
  document.getElementById("setupLive").addEventListener(
    "click", setupLive);
  document.getElementById("setupCapture").addEventListener(
    "click", setupCapture);
  document.getElementById("event").addEventListener(
    "click", check);

  chrome.storage.local.get('chosenDirectory', function(items) {
    if (items.chosenDirectory) {
      chrome.fileSystem.isRestorable(items.chosenDirectory, function(isRestorable) {
        if (isRestorable) {
          chrome.fileSystem.restoreEntry(items.chosenDirectory, function(entry) {
            writableDirectory = entry
          });
        } else {
          selectDirectory();
        }
      });
    } else {
      selectDirectory();
    }
  });
});
