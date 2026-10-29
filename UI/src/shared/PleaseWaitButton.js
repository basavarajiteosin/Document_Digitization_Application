import React from 'react'

const defaultProps = {
	className: "",
}

const PleaseWaitButton = (props = defaultProps) => {
	return (
		<button type="button" disabled={true} className={`btn btn-light ${props.className}`}><i className="fa fa-spinner fa-spin"></i> Please wait...</button>
	);
}

export default PleaseWaitButton