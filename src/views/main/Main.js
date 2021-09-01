// React Native Modules
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Image,
  Button,
  ToastAndroid
} from 'react-native';

// Tensorflow.js Modules
import * as tf from '@tensorflow/tfjs';
import {
  cameraWithTensors,
  detectGLCapabilities,
} from '@tensorflow/tfjs-react-native';

import * as handpose from '@tensorflow-models/handpose';

import {mostFrequent } from './../../utils/utils'

// Gesture Images
const thumbsUpImage = require('./../../assets/like.png')
const thumbsDownImage = require('./../../assets/dislike.png')


require('@tensorflow/tfjs-backend-webgl'); // Necessary

// Expo Modules
import { Camera } from 'expo-camera';
import Constants from 'expo-constants';
import * as Permissions from 'expo-permissions';
// import thumbsDownGesture from '../../helpers/thumbs_down';

// High order component to use camera functions
const TensorCamera = cameraWithTensors(Camera);

// Screen Dimensions
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

class TrackHandsScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isTfReady: false, // Determines if the TensorFlow module is loaded
      isModelReady: false, // Determines if @tensorflow-models/handpose model is loaded
      hasPermission: null, // Determines if the user has granted permission to access the cameras
      type: Camera.Constants.Type.front, // Defines the default camera type that will be used in the application
      frameCounter: 0,
      predictions: {},
      result: 0,
      processing: true,
    };
  }

  predictions = []

  /*
    Requests access to the camera asynchronously;
    If not granted, the app will not work;
  */
  getPermissionAsync = async () => {
    if (Constants.platform.ios) {
      const { status } = await Permissions.askAsync(Permissions.MEDIA_LIBRARY);
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
      }
    }
  };

  async componentDidMount() {
    // Change state to indicate TensorFlow module is loaded
    await tf.ready();
    this.setState({ isTfReady: true });

    // Change the state to indicate that the Handpose model is loaded
    this.model = await handpose.load({
      maxContinuousChecks: 2,
      detectionConfidence: 0.4,
      iouThreshold: 0.4,
      scoreThreshold: 0.80,
    });
    this.setState({ isModelReady: true });

    // Request user permission to access cameras
    this.getPermissionAsync();
    const { status } = await Permissions.askAsync(Permissions.CAMERA);

    // Determines whether the user has granted permission to access the cameras or not
    this.setState({ hasPermission: status === 'granted' });

  }

  showToast = (msg) => {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  };

  // Function to start hand gesture detection
  startProcess = () => {
    this.showToast("Next question!")
    this.setState({
      processing: true,
      result: 0
    })
  }

  // Function to end hand gesture detection
  endProcess = () => {
    this.setState({
      processing: false,
    })
  }

  handleCameraStream = (images, updatePreview, gl) => {
    console.log("gl capabilities -->", detectGLCapabilities(gl));

    const loop = async () => {
      const nextImageTensor = await images.next().value;

      if (this.state.frameCounter % 3 == 0) {
        const hand = await this.model.estimateHands(nextImageTensor);

        console.log("hands found ==>", hand.length)

        if (hand.length > 0) {
          this.predictGesture(hand)
          this.setState({ predictions: hand })
        }
        else {
          this.setState({
            result: 0
          })
        }

        // this.processingDrop();
        tf.dispose(hand)
      }
      tf.dispose(nextImageTensor)
      /* 
      Functions used by Tensorflow to update the frames of the
       camera on the mobile screen. UpdatePreview updates the frame,
       while gl.endFrameEXP processes the next frame.
      */
      updatePreview();
      gl.endFrameEXP();

      this.setState({ frameCounter: this.state.frameCounter + 1 });

      // Function that receives the next frame and returns to the beginning of the loop
      requestAnimationFrame(loop);
    };
    loop();
  };

  predictGesture = (resultant) => {
    // For 3D landmarks
    // x at index 0
    // y at index 1
    // z at index 2

    const thumbTip = resultant[0].landmarks[4]

    const indexJoint = resultant[0].landmarks[5]
    const pinkyJoint = resultant[0].landmarks[17]


    const isValid = Math.abs(indexJoint[0] - pinkyJoint[0]) < 50

    const pinkyGreaterThanIndex = indexJoint[1] < pinkyJoint[1]
    const pinkyGreaterThanThumb = thumbTip[1] < pinkyJoint[1]

    const isUp = pinkyGreaterThanIndex && pinkyGreaterThanThumb
    const isDown = !pinkyGreaterThanIndex && !pinkyGreaterThanThumb

    const result = isValid
      ? isUp
        ? 1
        : isDown
          ? 2
          : 0
      : 0

    this.predictions = [...this.predictions, result]

    if (this.predictions.length > 2) {
      console.log("modded result ==> ", mostFrequent(this.predictions))
      this.setState({
        result: mostFrequent(this.predictions)
      })
      this.predictions = [];
      this.endProcess()

      // some delay to display the detected gesture
      setTimeout(() => {
        this.startProcess()
      }, 3000);
    }

  }

  renderTensorCamera(textureDims, tensorDims) {
    return (
      <View>
        <TensorCamera
          // Standard Camera props
          style={styles.tfCameraView}
          type={this.state.type}
          // Tensor related props
          cameraTextureHeight={textureDims.height}
          cameraTextureWidth={textureDims.width}
          resizeHeight={tensorDims.height}
          resizeWidth={tensorDims.width}
          resizeDepth={3}
          onReady={this.handleCameraStream}
          autorender={false}
        />
      </View>
    );
  }

  render() {
    const textureDims =
      Platform.OS === 'ios'
        ? { height: 1920, width: 1080 }
        : { height: 1200, width: 1600 };
    const tensorDims = { width: 200, height: 200 };

    const {
      isTfReady,
      isModelReady,
      hasPermission,
    } = this.state;

    if (hasPermission === true) {
      // Loads the TensorCamera component and enables camera preview if showTensor === true
      return (
        <View style={styles.absoluteBackground}>
          {
            this.state.processing
              ? this.renderTensorCamera(textureDims, tensorDims)
              : null
          }
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: SCREEN_HEIGHT,
            width: SCREEN_WIDTH,
            zIndex: 10,
            backgroundColor: '#eaeaea',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 18,
              color: 'black',
              paddingHorizontal: 40,
              textAlign: 'center',
              marginBottom: 40
            }}>
              This is a dummy question for your feedback,
              please provide your valuable feedback by
              showing a thumbs up if you agree and thumbs down if you don't.
            </Text>
            <View style={{
              width: 200,
              height: 200,
              borderRadius: 100,
              shadowColor: this.state.result === 1 ? "#009138" : "#000",
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.23,
              shadowRadius: 2.62,

              elevation: 4,
              backgroundColor: this.state.result === 1 ? "#009138" : 'white',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 60
            }}>
              <Image style={{ width: 120, height: 120 }} source={thumbsUpImage} />
            </View>
            <View style={{
              width: 200,
              height: 200,
              borderRadius: 100,
              shadowColor: this.state.result === 2 ? "#009138" : "#000",
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.23,
              shadowRadius: 2.62,

              elevation: 4,
              backgroundColor: this.state.result === 2 ? "#009138" : 'white',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Image style={{ width: 120, height: 120 }} source={thumbsDownImage} />
            </View>
          </View>
        </View>
      );
    } else {
      // Initial loading screen
      return (<View style={{
        flex: 1,
        textAlign: 'center',
        alignItems: 'center'
      }}>
        <Text>Loading</Text>
      </View>)
    }
  }
}

const styles = StyleSheet.create({
  modalTextStyle: {
    fontWeight: 'bold',
    textAlign: 'center',
    alignSelf: 'center',
    paddingTop: SCREEN_HEIGHT * 0.29,
    position: 'absolute',
    fontSize: Dimensions.get('screen').fontScale * 35,
    color: '#dbdfef',
  },
  modalSubTextStyle: {
    fontWeight: 'bold',
    textAlign: 'center',
    alignSelf: 'center',
    paddingTop: SCREEN_HEIGHT * 0.35,
    position: 'absolute',
    fontSize: Dimensions.get('screen').fontScale * 22,
    color: '#dbdfef',
  },
  tfCameraView: {
    position: 'absolute',
    top: 0,
    left: 0,
    marginTop: SCREEN_HEIGHT * 2,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * .75,
    zIndex: 1,
    borderWidth: 0,
    borderRadius: 0,
    alignSelf: 'center',
    alignContent: 'center',
    justifyContent: 'center',
  },
  detectionText: {
    marginTop: SCREEN_HEIGHT * 0.25,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: 'bold',
    color: 'blue',
  },
  absoluteBackground: {
    width: Dimensions.get('screen').width,
    height: Dimensions.get('screen').height,
    backgroundColor: 'red',
  },
  ButtonStd: {
    alignSelf: 'center',
    borderRadius: 30,
    backgroundColor: '#FF6F61',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    fontWeight: 'bold',
    width: Dimensions.get('window').width * 0.6,
    height: Dimensions.get('window').height * 0.1,
  },
  box: {
    position: 'absolute',
    width: 10,
    height: 10
  }
});

export default TrackHandsScreen;
