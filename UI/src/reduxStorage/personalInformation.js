
import { createSlice } from '@reduxjs/toolkit';
import { capitalizeText } from '../common/textOperations';

export const personalInformation = createSlice({
  name: "Personal Information",
  initialState: {
    userID: "",
    employeeId: "",
    userRole: "",
    displayName: "",
    emailAddress: "",
    menuItemNames: [],
    token: "",
    profilePic: "",
    firstName: "",
    lastName: "",
    clientId: "",
    department: "",
    designation: "",
    division: "",
    activeComponentName: "", 
    isChangePasswordRequired:"",
  },
  reducers: {
    setUserPersonalInformation: (state, action) => {
      return {
        ...state, 
        userID: action.payload.userID || state.userID,
        employeeId: capitalizeText(action.payload.employeeId) || state.employeeId,
        userRole: action.payload.userRole || state.userRole,
        displayName: action.payload.displayName || state.displayName,
        emailAddress: action.payload.emailAddress || state.emailAddress,
        menuItemNames: action.payload.menuItemNames || state.menuItemNames,
        token: action.payload.token || state.token,
        profilePic: action.payload.profilePic || state.profilePic,
        firstName: action.payload.firstName || state.firstName,
        lastName: action.payload.lastName || state.lastName,
        clientId: action.payload.clientId || state.clientId,
        designation: action.payload.designation || state.designation,
        division: action.payload.division || state.division,
        isChangePasswordRequired: action.payload.isChangePasswordRequired || state.isChangePasswordRequired,
      };
    },
    setActiveComponentName: (state, action) => {
      state.activeComponentName = action.payload; // Update active component name
    },
  },
});

export const { setUserPersonalInformation, setActiveComponentName } = personalInformation.actions;

export default personalInformation.reducer;
