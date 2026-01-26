import React, { Component } from 'react';
import * as ReactTabulatorModule from '@tabulator/react-tabulator/lib/ReactTabulator';
const ReactTabulator = ReactTabulatorModule.default;

class MyTabulator extends Component {
    constructor(props) {
        super(props);
        this.recordTabRef = this.recordTabRef.bind(this);
        this.ref = null;
    }

    // Without this, an edit of a cell used to lose the
    // scroll position of the ReactTabulator. Paging is not an issue
    shouldComponentUpdate(nextProps, nextState) {
        if (this.props.options.paginationSize !== nextProps.options.paginationSize || 
            this.props.options.chronology !== nextProps.options.chronology || 
            this.props.options.forceRefresh !== nextProps.options.forceRefresh ||
            this.props.options.height !== nextProps.options.height ||
            this.props.columns !== nextProps.columns) {
            return true;
        }
        return false;
    }

    componentWillUnmount() {
        this.ref = null;
    }

    recordTabRef(ref) {
        // innerref is there purely to forward the ref back to caller. 
        const { innerref } = this.props;
        this.ref = ref;
        innerref(ref);
        return true;
    }

    render() {
        return <ReactTabulator {...this.props} ref={this.recordTabRef} />;
    }
}

export default MyTabulator;
