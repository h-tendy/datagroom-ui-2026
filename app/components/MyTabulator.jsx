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
        const pageSizeChanged = this.props.options.paginationSize !== nextProps.options.paginationSize;
        const chronologyChanged = this.props.options.chronology !== nextProps.options.chronology;
        const forceRefreshChanged = this.props.options.forceRefresh !== nextProps.options.forceRefresh;
        const heightChanged = this.props.options.height !== nextProps.options.height;
        const columnsChanged = this.props.columns !== nextProps.columns;
        const themeChanged = this.props.options.currentTheme !== nextProps.options.currentTheme;
        
        const shouldUpdate = pageSizeChanged || chronologyChanged || forceRefreshChanged || heightChanged || columnsChanged || themeChanged;
        
        if (shouldUpdate) {
            console.log('[DEBUG REFRESH] \u26a0\ufe0f MyTabulator shouldComponentUpdate = TRUE - Table will re-render!', {
                pageSizeChanged,
                chronologyChanged,
                forceRefreshChanged,
                heightChanged,
                columnsChanged,
                themeChanged,
                oldColumns: this.props.columns?.length,
                newColumns: nextProps.columns?.length,
                timestamp: new Date().toISOString()
            });
        }
        
        return shouldUpdate;
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
