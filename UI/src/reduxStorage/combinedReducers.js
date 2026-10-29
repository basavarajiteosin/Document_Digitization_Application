import { configureStore } from '@reduxjs/toolkit';
import personalInformationReducer from './personalInformation';
import { combineReducers } from 'redux';

import {
    createTransform,
    persistStore,
    persistReducer,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import { encryptTransform } from 'redux-persist-transform-encrypt';

const config = require('../services/config.json');


const rootReducer = combineReducers({
    personalInformationReducer,
});

const encryptor = encryptTransform({
    secretKey: config.EncryptKey,
    onError: (error) => {

    }
})

const personalInfoTransform = createTransform(
    (inboundState, key) => {
        return {...inboundState, dob: inboundState.dob ? inboundState.dob.toDateString() : ""}
    }, 
    (outboundState, key) => {
        return {...outboundState, dob: outboundState.dob ? new Date(outboundState.dob) : ""}
    },
    { whitelist: ['personalInformationReducer']}
)


const persistConfig = {
    key: 'pmo_user',
    version: 1,
    transforms: [personalInfoTransform, encryptor],
    storage,
}


const persistedReducer = persistReducer(persistConfig, rootReducer)

const reduxStore = configureStore({
    reducer: persistedReducer,      
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: {
            ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
    }),
})

persistStore(reduxStore)

export default reduxStore;