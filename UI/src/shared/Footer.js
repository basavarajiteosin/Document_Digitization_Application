const config = require('../services/config.json');
 function Footer() {
    return (
        <>
           <footer className="main-footer ">
                <strong> &copy; 2024-2025 <a href="#" className='footer-a'>{config.PoweredBy}</a>.</strong>&nbsp;
                All rights reserved.
                <div className="float-right d-none d-sm-inline-block">
                    <b>Version</b> {config.version}
                </div>
            </footer>
        </>
    );
}

export default Footer;