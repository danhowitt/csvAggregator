import * as React from 'react'
import Link from 'gatsby-link'
import 'bootstrap/dist/css/bootstrap.min.css';
import { Card, CardText, CardTitle, Button, InputGroup, Input, InputGroupAddon, FormGroup, Label,  Dropdown, DropdownMenu, DropdownItem, DropdownToggle, UncontrolledDropdown } from 'reactstrap';
import { parse as csvParse, unparse } from 'papaparse'
import * as moment from 'moment'
import {BigNumber} from 'bignumber.js'

// Please note that you can use https://github.com/dotansimha/graphql-code-generator
// to generate all types from graphQL schema
interface IndexPageProps {
  data: {
    site: {
      siteMetadata: {
        title: string
      }
    }
  }
}

BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

export default class extends React.Component<IndexPageProps, { fileName: string, aggregatebyColumns: string[], columns: string[], numericColumns: string[], dateColumns: string[], dataLines: string[][], adjustments: { [columnName: string]: number } }> {
  constructor(props: IndexPageProps, context: any) {
    super(props, context)
    this.state = {
      columns: [],
      numericColumns: [],
      dateColumns: [],
      dataLines: [],
      adjustments: {},
      aggregatebyColumns: [],
      fileName: ''
    }
  }

  groupByMultiple(array: any[], f: any) {
    let groups: any = {};
    array.forEach(function (o) {
      var group = JSON.stringify(f(o));
      groups[group] = groups[group] || [];
      groups[group].push(o);
    });
  return Object.keys(groups).map(function (group) {
   return groups[group];
  })
  }

  handleFile(fileList: FileList) {
    const file = fileList[0];
    var reader = new FileReader();

    this.setState({
     
        columns: [],
        numericColumns: [],
        dateColumns: [],
        dataLines: [],
        adjustments: {},
        aggregatebyColumns: [],
        fileName: ''
      
    })

    reader.onload = () => {
      const fileText = reader.result as string;
      const parsed =  csvParse(fileText);

      const lines = parsed.data as string[][];
      const columns = lines[0] as string[];
      const dataLines = lines.splice(1).filter(x => x.length > 1);

      this.setState({
        dataLines
      })

      const numericColumns = columns.filter((_, columnIndex) => {
        return dataLines.some(line => {
          return /^-?\d+\.?\d*$/.test(line[columnIndex])
        });
      });

      const dateColumns = columns.filter((_, columnIndex) => {
        return dataLines.every(line => {
          return moment.utc(line[columnIndex]).isValid();
        });
      });

      const fileName = file.name;

      this.setState({ columns, numericColumns, dateColumns, fileName });
    }
    reader.readAsText(file);
  }

  handleAdjustment (columnName: string, adjustmentPercentage: number) {
    const adjustments = { ...this.state.adjustments };
    adjustments[columnName] = adjustmentPercentage;
    this.setState({
      adjustments
    });
  }

  download() {
    const adjustments = this.state.adjustments;
    const newCsv = [ ... this.state.dataLines];

    const grouped = this.groupByMultiple(newCsv, (line: string[]) => {
      return this.state.aggregatebyColumns.map(aggregateColumn => {
        const idx = this.state.columns.indexOf(aggregateColumn);
        if (this.state.dateColumns.indexOf(aggregateColumn) > -1) {
          line[idx] = moment.utc(line[idx]).startOf('day').format("YYYY-MM-DD HH:mm:ss");

        }
        return line[idx];
      });
    });

    console.log('group count', grouped.length);
    
    const reducer =  grouped.map(group => {
        return group.reduce((aggregateLine: any, currentLine: any, idx: any) => {
          this.state.numericColumns.forEach((numericColumnName) => {
            const numericColumnIndex = this.state.columns.indexOf(numericColumnName);
            let lineValue = new BigNumber(currentLine[numericColumnIndex]);
            
            if (adjustments[numericColumnName]) {
               lineValue = lineValue.dividedBy(100).multipliedBy(adjustments[numericColumnName]);
            }
            aggregateLine[numericColumnIndex] = new BigNumber(idx === 0 ? 0 : aggregateLine[numericColumnIndex]).plus(lineValue).toFixed(8);
          })

          
          return aggregateLine;
        }, [...group.length > 0 ? group[0] : []]);
      });
    
    
    const csv = unparse({
      fields: this.state.columns,
      data: reducer
    })

    var pom = document.createElement('a');
    var csvContent=csv; //here we load our csv data 
    var blob = new Blob([csvContent],{type: 'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    pom.href = url;
    pom.setAttribute('download', `${this.state.fileName.split('.')[0]}_grouped_by_${this.state.aggregatebyColumns.join('_')}.csv`);
    pom.click();
  }

  toggleGroupBy(aggregatebyColumn: string) {
    const aggregateColumns = new Set(this.state.aggregatebyColumns);
    if (this.state.aggregatebyColumns.indexOf(aggregatebyColumn) > -1) {
      aggregateColumns.delete(aggregatebyColumn)
    } else {
      aggregateColumns.add(aggregatebyColumn)
    }
    this.setState({
      aggregatebyColumns: Array.from(aggregateColumns)
    });
  }

  public render() {
    return (
    

      <Card body outline color="secondary">
        <CardTitle>CSV Parser</CardTitle>
        <CardText>Upload a csv file</CardText>

        <CardText>
          <Input type="file" placeholder="username" onChange={(e: any) => this.handleFile(e.target.files)} />
        </CardText>

        {this.state.numericColumns.length > 0 && (
            <CardText>Enter percentages for each numeric field</CardText>
        )}

        {this.state.numericColumns.map((columnName) => 
          <FormGroup>
            <Label for="exampleEmail">{columnName}</Label>
            <InputGroup>
            
              <Input placeholder="Adjustment percentage"  type="number" step="1" onChange={(e) => this.handleAdjustment(columnName, e.target.value)} />
              <InputGroupAddon addonType="append">%</InputGroupAddon>
            </InputGroup>
          </FormGroup>
        )}

        {this.state.dataLines.length > 0 && (
          <CardText>Aggregate numeric columns and group by</CardText>
        )}

        {this.state.dataLines.length > 0 && (
          <div>
           
            {this.state.columns.map(columnName => 
               <FormGroup check inline>
               <Label check>
                 <Input type="checkbox" onClick={(e) => this.toggleGroupBy(columnName)} />{columnName}
               </Label>
             </FormGroup>
            )}

            <div style={{'paddingTop': '20px'}}>
            <Button onClick={() => this.download()}>Download</Button>
            </div>
          </div>

        )}
      </Card>
    )
  }
}

export const pageQuery = graphql`
  query IndexQuery {
    site {
      siteMetadata {
        title
      }
    }
  }
`
