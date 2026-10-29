import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import PleaseWaitButton from '../../shared/PleaseWaitButton';
import { removeExtraSpaces } from '../../common/textOperations';
import { useDispatch } from "react-redux";
import { setUserPersonalInformation } from '../../reduxStorage/personalInformation';
// import './login.css';
// const axios = require('axios');
const config = require('../../services/config.json');

const ForgotPassword = () => {
	const inputUserEmailReference = useRef(null);
	const inputUserPasswordReference = useRef(null);

	const dispatch = useDispatch()
	let navigate = useNavigate();
	//const userRef = useRef();
	const [forgotPassworClick, setForgotPassworClick] = useState(false);
	const [userEmail, setUserEmail] = useState('');
	const [userPassword, setUserPassword] = useState('');
	const [userForgotEmail, setUserForgotEmail] = useState('');
	const [userForgotConfirmEmail, setUserForgotConfirmEmail] = useState('');
	const [isLoaderActive, setIsLoaderActive] = useState(false);

	let handleForgotPassword = (e) => {
		setUserEmail('');
		setUserPassword('');
		setForgotPassworClick(true);
	}

	let handleSignIn = (e) => {
		setUserForgotEmail('');
		setUserForgotConfirmEmail('');
		setForgotPassworClick(false);

	}

	const handleSignInAccount = (e) => {
		if (removeExtraSpaces(userEmail)) {
			if (userPassword) {
				setIsLoaderActive(true);
				axios.post(config.API_URL + 'AuthController/token', {
					"userName": userEmail,
					"password": userPassword
				}, {
					headers: config.headers2,
				}).then((response) => {
					if (response.status == 200) {
						if (response.data.success == 'success') {
							toast.success(response.data.message);
							let responseData = response.data.data;
							console.log("responseData--->",responseData);
							let user_ID = responseData.userID;
							localStorage.setItem('user_id', user_ID);
							localStorage.setItem('isUserAuthenticated', true);
							dispatch(setUserPersonalInformation({
								userID: responseData.userID,
								userName: responseData.userName,
								userRole: responseData.userRole,
								displayName: responseData.displayName,
								emailAddress: responseData.emailAddress,
								menuItemNames: [],
								token: responseData.token,
								profilePic: responseData.profilePic,
								firstName: responseData.firstName,
								lastName: responseData.lastName,
								clientId: "",
								department: responseData.accountGroup
							}));
							setTimeout(() => {
								setIsLoaderActive(false);
								// if (responseData.menuItemNames.length > 0) {
									navigate('/main-dashboard');
								// }
							}, 1000)

						} else {
							setIsLoaderActive(false);
							toast.error(response.data.message);
						}
					} else if (response.data.status.status == 500) {
						setIsLoaderActive(false);
						toast.error("Invalid username or password");
					}
				}).catch((error) => {
					toast.error("oops something went wrong. please try again later.");
					setIsLoaderActive(false);
				})
			} else {
				inputUserPasswordReference.current.focus();
				toast.error("Please enter your password.");
			}
		} else {
			inputUserEmailReference.current.focus();
			toast.error("Please enter your email address.");
		}
	}

	const onEnterKeyPress = (event) => {
		if (event.keyCode === 13) {
			handleSignInAccount();
		}
	}

	const handleForgotPasswordSubmit = (e) => {
		if (removeExtraSpaces(userForgotEmail)) {
			if (removeExtraSpaces(userForgotConfirmEmail)) {
				if (removeExtraSpaces(userForgotConfirmEmail) == removeExtraSpaces(userForgotEmail)) {
					setIsLoaderActive(true);
					axios.post(config.API_URL + 'AuthMasterController/SendResetLinkToMail', {
						"emailAddress": userForgotEmail,
						// "userName": "",
						"siteURL": " "
					}, {
						headers: config.headers2,
					}).then((response) => {
						console.log(response)
						if (response.status == 200) {
							if (response.data.success == 'success') {
								toast.success(response.data.message);
								let responseData = response.data.data;
								setTimeout(() => {
									setIsLoaderActive(false);
								}, 1500)

							} else {
								setIsLoaderActive(false);
								toast.error(response.data.message);
							}
						} else if (response.data.status.status == 500) {
							setIsLoaderActive(false);
							toast.error("Invalid username or password");
						}

					}).catch((error) => {
						if (error.response.status == 400) {
							toast.error("Bad request");
						} else if (error.response.status == 401) {
							toast.error("You are not authorized person")
						} else if (error.response.status == 403) {
							toast.error("Forbidden")
						} else if (error.response.status == 404) {
							toast.error("Not found")
						} else if (error.response.status == 500) {
							toast.error("Internal server error")
						} else if (error.response.status == 502) {
							toast.error("Bad gateway");
						} else if (error.response.status == 503) {
							toast.error("Service unavailable");
						} else if (error.response.status == 504) {
							toast.error("Gateway timeout");
						}
						setIsLoaderActive(false);
					})
				} else {
					toast.error("The email and confirm email are not same.");
				}
			} else {
				toast.error("Please confirm your email.");
			}
		} else {
			toast.error("Please enter your email address.");
		}
	}

	return (
		<div className='loginPage'>
			<div className={forgotPassworClick ? 'container right-panel-active' : 'container'} id="container" style={{ top: '15%' }}>
				<div className="form-container sign-up-container">
					<form action="#" >
						<h3>Forgot Password</h3>
						<h6>Enter your email for get the reset password link</h6>
						<input type="email" clas value={userForgotEmail} onChange={(e) => setUserForgotEmail(e.target.value)} placeholder="Your Email" />
						<input type="email" value={userForgotConfirmEmail} onChange={(e) => setUserForgotConfirmEmail(e.target.value)} placeholder="Confirm Your Email" />
						{isLoaderActive ? <PleaseWaitButton className='btn-sm  font-weight-medium auth-form-btn' /> :
							<button type='button' onClick={(e) => { handleForgotPasswordSubmit(e) }}>Submit</button>
						}

					</form>
				</div>
				<div className="form-container sign-in-container" onKeyDown={(e) => onEnterKeyPress(e)}>
					<form action="#" >
						<h3>Sign in</h3>

						<h6 className='mb-3'>Please enter your email and password for sign In</h6>
						<input type="email" ref={inputUserEmailReference} value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Your Email" />
						<input type="password" ref={inputUserPasswordReference} value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Your Password" />
						{isLoaderActive ? <PleaseWaitButton className='btn-sm  font-weight-medium auth-form-btn' /> :
							<button type='button' onClick={(e) => { handleSignInAccount(e) }}>Sign In</button>
						}

					</form>
				</div>
				<div className="overlay-container">
					<div className="overlay">
						<div className="overlay-panel overlay-left">
							<img src={require("../../assets/images/Hlogo.png")} className='logo' alt="logo" />
							<h3>Welcome Back!</h3>
							<p style={{ color: '#353535' }}>To keep connected with us please login with your personal info</p>
							<button type='button' className="ghost" id="signIn" onClick={(e) => { handleSignIn(e) }}>Sign In</button>
						</div>
						<div className="overlay-panel overlay-right">
							<img src={require("../../assets/images/Hlogo.png")} className='logo' alt="logo" />
							<h3>Hello, Friend!</h3>
							<p style={{ color: '#353535' }}>Enter your credential details and start your today journey</p>
							<button type='button' className="ghost" id="signUp" onClick={(e) => { handleForgotPassword(e) }}>Forgot your password?</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ForgotPassword;