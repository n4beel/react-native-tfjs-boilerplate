// React Native Modules
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Image
} from 'react-native';

// Tensorflow.js Modules
import * as tf from '@tensorflow/tfjs';
import {
  cameraWithTensors,
  detectGLCapabilities,
} from '@tensorflow/tfjs-react-native';

import * as handpose from '@tensorflow-models/handpose';

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
      thumb: [100, 100, 100],
      pinky: [100, 100, 100],
      result: 0,
    };
  }

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

  handleCameraStream = (images, updatePreview, gl) => {
    console.log("gl capabilities -->", detectGLCapabilities(gl));

    const loop = async () => {
      const nextImageTensor = await images.next().value;

      if (this.state.frameCounter % 10 == 0) {
        const hand = await this.model.estimateHands(nextImageTensor);

        console.log("hands found ==>", hand.length)

        if (hand.length > 0) {
          // console.log(JSON.stringify(hand))
          this.predictGesture(hand)
          this.setState({ predictions: hand })

          // const GE = new fp.GestureEstimator([
          //   fp.Gestures.ThumbsUpGesture,
          //   thumbsDownGesture
          // ]);
          // const gesture = await GE.estimate(hand[0].landmarks, 4);
          // if (gesture.gestures !== undefined && gesture.gestures.length > 0) {
          //   console.log("gesture.gesture ==>", gesture.gestures);

          //   const confidence = gesture.gestures.map(
          //     (prediction) => prediction.confidence
          //   );
          //   const maxConfidence = confidence.indexOf(
          //     Math.max.apply(null, confidence)
          //   );
          //   console.log("final ==>", gesture.gestures[maxConfidence].name);
          //   // setEmoji(gesture.gestures[maxConfidence].name);
          //   this.setState({
          //     result: gesture.gestures[maxConfidence].name === "thumbs_up"
          //       ? 1
          //       : gesture.gestures[maxConfidence].name === "thumbs_down"
          //         ? 2
          //         : 0
          //   })
          // }
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

  predictGesture(resultant) {
    // x at index 0
    // y at index 1
    // z at index 2
    // console.log(JSON.stringify(resultant))


    const thumbTip = resultant[0].landmarks[4]

    const indexTip = resultant[0].landmarks[8]
    const middleTip = resultant[0].landmarks[12]
    const ringTip = resultant[0].landmarks[16]
    const pinkyTip = resultant[0].landmarks[20]

    const indexJoint = resultant[0].landmarks[5]
    const middleJoint = resultant[0].landmarks[9]
    const ringJoint = resultant[0].landmarks[13]
    const pinkyJoint = resultant[0].landmarks[17]

    this.setState({
      thumb: thumbTip,
      pinky: pinkyJoint
    })

    console.log("======================================")

    console.log("index length ==>", Math.abs(indexJoint[0] - indexTip[0]))
    console.log("middle length ==>", Math.abs(middleJoint[0] - middleTip[0]))
    console.log("ring length ==>", Math.abs(ringJoint[0] - ringTip[0]))
    console.log("pinky length ==>", Math.abs(pinkyJoint[0] - pinkyTip[0]))

    console.log("--------------------------------------")

    console.log("index joint x ==>", indexJoint[0])
    console.log("pinky joint x ==>", pinkyJoint[0])

    console.log("joint difference x ==>", Math.abs(indexJoint[0] - pinkyJoint[0]))

    console.log("--------------------------------------")

    console.log("thumb tip y ==>", thumbTip[1])
    console.log("pinky joint y ==>", pinkyJoint[1])

    console.log("--------------------------------------")

    console.log("is valid ==>", Math.abs(indexJoint[0] - pinkyJoint[0]) < 20)
    console.log("is thumb up ==>", thumbTip[1] < pinkyJoint[1])

    console.log("--------------------------------------")

    const isValid = Math.abs(indexJoint[0] - pinkyJoint[0]) < 20
    const isUp = thumbTip[1] < pinkyJoint[1]

    console.log("result ==>", isValid
      ? isUp
        ? "thumbs up"
        : "thumbs down"
      : "invalid")

    console.log("======================================")

    this.setState({
      result: isValid
        ? isUp
          ? 1
          : 2
        : 0
    })

  }

  renderTensorCamera(textureDims, tensorDims) {
    return (
      <View>
        {false ? (
          <Text style={styles.detectionText}>
            Estimating hands. Check log at the console.
          </Text>
        ) : null}
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
          {this.renderTensorCamera(textureDims, tensorDims)}
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
      // return this.loadingScreen(isTfReady, isModelReady, hasPermission);
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
