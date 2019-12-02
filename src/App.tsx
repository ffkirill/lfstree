import React from 'react';
import logo from './logo.svg';
import { List, AutoSizer } from 'react-virtualized';
import CSS from 'csstype';
import 'react-virtualized/styles.css';
import './App.css';
import { AssertionError } from 'assert';

interface RowMeta {
    isChecked: boolean;
}

interface GroupMeta {
    numTotal: number;
    numChecked: number;
    expanded: boolean;
}

enum GroupsActionType {
    Check = '+',
    Uncheck = '-',
    Nothing = ''
}

interface GroupAction {
    type: GroupsActionType;
    id: number;
}

interface GroupsStackFrame {
    action: GroupsActionType,
    group: Group;
}

function getAction(stack: Array<GroupsStackFrame>) {
    for (let frame of stack) {
        if (frame.action !== GroupsActionType.Nothing) {
            return frame.action;
        }
    }
    return GroupsActionType.Nothing;
}

function isVisible(elem: TreeElement, stack: Array<GroupsStackFrame>): boolean {
    for (let frame of stack) {
        if (frame.group.id == elem.id) {
            continue;
        }
        if (!frame.group.meta.expanded) {
            return false;
        }
    }
    return true;
}

interface RawData {
    id: number;
    haschild: boolean;
    higher: number|null;
    level: number;
    name: string;
}

interface Row extends RawData {
    meta: RowMeta;
}

interface Group extends RawData {
    meta: GroupMeta;
}

type TreeElement = Row|Group;

function isRow(r: TreeElement): r is Row {
    return !r.haschild;
}

function isGroup(r: TreeElement): r is Group {
    return r.haschild;
}


interface LFTreeState {
    //Model
    tree: Array<TreeElement>;
    filter: string;
    
    //ViewModel
    expanded: Set<number>;
}

interface LFTreeStateProps {

}

const ListStyle: CSS.Properties = {
    textAlign: "left"
};

async function fetchJsonRpc(endpoint: string, method_name: string, params: any) {
    const request = {
        "id": "httpReq",
        "version": "2.0",
        "method": method_name,
        "params": {}
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(request)
    });

    return await (response.json());

}

class App extends React.Component<LFTreeStateProps, LFTreeState> {
    private checked: Set<number> = new Set();
    private storage: Array<RawData> = [];

    constructor(props: LFTreeStateProps) {
        super(props);
        this.state = {
            tree: Array(),
            filter: '',
            expanded: new Set()
        };
    }

    async componentDidMount() {
        debugger;
        this.storage = [
                {
                    id: 1,
                    haschild: true,
                    name: '10',
                    higher: null,
                    level: 1
                },{
                    id: 2,
                    haschild: true,
                    name: '20',
                    higher: 1,
                    level: 2
                },{
                    id: 3,
                    haschild: false,
                    name: '30',
                    higher: 2,
                    level: 3
                },{
                    id: 4,
                    haschild: false,
                    name: '40',
                    higher: 2,
                    level: 3
                },{
                    id: 5,
                    haschild: true,
                    name: '50',
                    higher: null,
                    level: 1
                },{
                    id: 6,
                    haschild: false,
                    name: '60',
                    higher: 5,
                    level: 2
                },{
                    id: 7,
                    haschild: false,
                    name: '70',
                    higher: 5,
                    level: 2
                },
            ]
        this.doNextRun();
    }

    handleExpandToggle(event: any, id: number) {
        event.preventDefault();
        const current = this.state.expanded;
        if (current.has(id)) {
            const next = this.state.expanded;
            next.delete(id);
            this.setState({expanded: new Set(next)});
        } else {
            this.setState({expanded: new Set(this.state.expanded.add(id))});
        }
        this.doNextRun();
    }

    handleRowCheckToggle(event: any, id: number) {
        event.preventDefault();
        if (this.checked.has(id)) {
            this.checked.delete(id);
        } else {
            this.checked.add(id);
        }
        this.doNextRun();
    }

    handleGroupCheckToggle(event: any, id: number, checked: boolean) {
        event.preventDefault();
        if (!checked) {
            this.doNextRun({id: id, type: GroupsActionType.Check});
            console.log(`Group toggle ${id} + `);
        } else {
            this.doNextRun({id: id, type: GroupsActionType.Uncheck});
            console.log(`Group toggle ${id} - `);
        }
    }

    isExpanded(row: Row) {
       return this.state.expanded.has(row.id);
    }

    expandBtn(row: Group) {
        function _b(g: Group) {
            return g.meta.expanded? "-" : "+" 
        }
            return <button onClick={e=>(this.handleExpandToggle(e, row.id))}> {_b(row)} </button>
    }

    checkbox(row: TreeElement) {
        function _b(flag: boolean) {
            return flag? "☑" : "☐" 
        }
        if (isGroup(row)) {
            const checked = row.meta.numChecked > 0;
            const isGrey = checked && (row.meta.numChecked < row.meta.numTotal);
            
            return [` ${row.meta.numChecked} of ${row.meta.numTotal} `,
                <button onClick={e=>this.handleGroupCheckToggle(e, row.id, checked)}
                style={isGrey? {color: "grey"}: {}}>{_b(checked)}</button>]
            
        } else {
            return <button onClick={e=>this.handleRowCheckToggle(e, row.id)}>{_b(row.meta.isChecked)}</button>

        }
    }
    
    doNextRun(groupAction?: GroupAction) {
        const w = this;
        const output: Array<TreeElement> = [];
        const stack: Array<GroupsStackFrame> = [];
        const tabWidth = 30 //px;
        const nextChecked: Set<number> = new Set();
        let lastParent: Group;
        let level = 1;
     
        for (let [num, _row] of w.storage.entries()) {
            const elem = _row as TreeElement; 
            
            if (elem.level < level) { //If exit
                for (;level!=_row.level; level--) {
                    stack.pop();
                }
            }
            
            if (isGroup(elem)) {
                let action = GroupsActionType.Nothing;
                elem.meta = {
                    numTotal: 0,
                    numChecked: 0,
                    expanded: this.state.expanded.has(elem.id)
                }
                if (groupAction &&  groupAction.id == elem.id) {
                    action = groupAction.type;
                }

                stack.push({action: action, group: elem});

            } else {
                let action = getAction(stack);
                let checked = false;
                if (action != GroupsActionType.Nothing) {
                    checked = action == GroupsActionType.Check? true: false;
                } else {
                    checked = this.checked.has(elem.id);
                }
                elem.meta = {
                    isChecked: checked
                }
                if (checked) {
                    nextChecked.add(elem.id);
                }
            }
            
            if (isRow(elem)) {
                for (let frame of stack) {
                    frame.group.meta.numTotal += 1;
                    if (elem.meta.isChecked) {
                        frame.group.meta.numChecked +=1;
                    }
                }
            }

            if (elem.level > level) { //Inner
                if (elem.level != level + 1) {
                    throw new AssertionError({message: 'Broken tree, level invariant check failed '});
                };
                level +=1;
            }
            
            debugger;
            if (elem.level == 1 || isVisible(elem, stack)) {
                output.push(elem);
            }
        }
        this.checked = nextChecked;
        this.setState({tree: output});
        this.forceUpdate();
    }

    render() {
        const w = this;
        function rowRenderer(params: any) {
            const row = w.state.tree[params.index];
            let rowCss: CSS.Properties = {
                paddingLeft: `${row.level * 30}px`
            };

            rowCss = {...rowCss, ...params.style};

            const content = <span>
                
                { isGroup(row)? w.expandBtn(row): null }
                { row.name }

                { w.checkbox(row) }
            </span>;
            //{ " " + row.meta.numChildChecked } of { row.meta.numTotal }
          return (
              <div key={params.key} className={"row"} style={rowCss}>
                  { content }
              </div>
          );
        }

        return (
            <div className="App">
                <header className="App-header">
                    <img src={logo} className="App-logo" alt="logo"/>
                    <p>
                        Edit <code>src/App.tsx</code> and save to reload.
                    </p>
                    <a
                        className="App-link"
                        href="https://reactjs.org"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Learn React
                    </a>
                </header>
                checked rows: {this.checked}<br/>
                expanded rows: {this.state.expanded}<br/>
                <AutoSizer disableHeight>
                    {({width}) => (
                        <List className={"List"}
                            overscanRowCount={10}
                            style={ListStyle}
                            width={width}
                            height={500}
                            rowCount={w.state.tree.length}
                            rowHeight={20}
                            rowRenderer={rowRenderer}
                        />
                  )}
                </AutoSizer>
            </div>
        )
    }
}

export default App;
