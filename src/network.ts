import { networkInterfaces } from "os"

const p5 = require('p5js-node')
const path = require('path')
const fs = require('fs')

enum NodeType {
    Input,
    Output,
    Hidden,
} 

function printList(list: Array<any>) {
    console.log(`[${list.join(', ')}]`)
}

function nodeTypeStr(type: NodeType): string {
    switch (type) {
        case NodeType.Input:
            return 'input'
        case NodeType.Output:
            return 'output'
        case NodeType.Hidden:
            return 'hidden'
        default:
            return 'unknown'
    }
}

interface NetNode {
    type: NodeType
    value: number
    id: number
}

function printNode(node: NetNode) {
    const str = `[id-${node.id}: ${nodeTypeStr(node.type)}] v: ${node.value}`
    console.log(str)
}

function printNodeList(list: Array<NetNode>) {
    list.forEach((node) => printNode(node))
}

interface NetLink {
    in: number
    out: number
    weight: number
    enabled: boolean 
    inno: number
}

function printLink(link: NetLink) {
    const enabledStr = link.enabled ? 'enabled' : 'disabled'
    const str = `[inno-${link.inno}] [${enabledStr}] [${link.in} -> ${link.out}] w: ${link.weight}`
    console.log(str)
}

function printLinkList(list: Array<NetLink>) {
    list.forEach((link) => printLink(link))
}

// Squash functions
const squashFunctions = {
    Linear: (val) => val,
    Sigmoid: (val) => 1 / (1 + Math.exp(-val)),
    SignedSigmoid: (val) => (2 / (1 + Math.exp(-val))) - 1,
    Relu: (val) => val > 0 ? val : 0
}

interface NetworkConfig {
    squash: (val: number) => number,
    evalIterations: number,
}

class Network {
    config: NetworkConfig
    nodes: Array<NetNode>
    links: Array<NetLink>
    inputs: number
    outputs: number

    constructor(inputs, outputs, config) {
        this.inputs = inputs
        this.outputs = outputs
        this.config = config
        this.nodes = []
        this.links = []

        for (let i = 0; i < this.inputs; i++) {
            this.nodes.push({type: NodeType.Input, value: 0, id: this.nodes.length})
        }

        for (let i = 0; i < this.outputs; i++) {
            this.nodes.push({type: NodeType.Output, value: 0, id: this.nodes.length})
        }
    }

    maxInno(): number {
        if (this.links.length == 0) return 0
        const inno_numbers = this.links.map((link) => link.inno)
        return Math.max(...inno_numbers)
    }

    getNodesOfType(type: NodeType): Array<NetNode> {
        return this.nodes.filter((node) => node.type == type)
    }

    addLink(global_inno: number, input: number, output: number, weight: number): number {
        let inNode = this.nodes[input]
        let outNode = this.nodes[output]
        
        if (inNode.type == NodeType.Output) {
            throw 'inNode type is output'
        }

        if (outNode.type == NodeType.Input) {
            throw 'outNode type is input'
        }

        let new_inno = global_inno + 1

        let link: NetLink = {
            in: input,
            out: output,
            weight: weight,
            enabled: true,
            inno: new_inno
        }

        this.links.push(link)

        return new_inno
    }

    getLink(inno: number): NetLink {
        return this.links.find((link) => link.inno == inno)
    }

    getInputLinks(id: number): Array<NetLink> {
        return this.links.filter((link) => link.out == id)
    }

    getInputNodes(id: number): Array<NetNode> {
        return this.getInputLinks(id).map((link) => this.nodes[link.in])
    }

    getInputValues(id: number): Array<number> {
        return this.getInputLinks(id).map((link) => this.nodes[link.in].value)
    }

    eval(input: Array<number>): Array<number> {
        if (input.length != this.inputs) {
            throw 'wrong number of inputs'
        }

        // Set input nodes
        this.getNodesOfType(NodeType.Input).forEach((node, index) => {
            node.value = input[index]
        })

        for (let t = 0; t < this.config.evalIterations; t++) {
            this.nodes.forEach((node) => {
                let inputLinks = this.getInputLinks(node.id)
                let inputValues = this.getInputValues(node.id)

                if (inputLinks.length != inputValues.length) {
                    throw 'inputLink length != inputValue length'
                }

                if (inputLinks.length > 0) {
                    // Sum
                    var sum = 0
                    for (let i = 0; i < inputLinks.length; i++) {
                        if (inputLinks[i].enabled) {
                            let weight = inputLinks[i].weight
                            let value = inputValues[i]
                            sum += weight * value
                        }
                    }

                    // Squash and set value
                    node.value = this.config.squash(sum)
                }
            })
        }

        return this.getNodesOfType(NodeType.Output).map((node) => node.value)
    }

    print() {
        console.log('-- NETWORK --')
        console.log('Nodes:')
        this.nodes.forEach((node, i) => {
            printNode(node)
        })

        console.log()

        console.log('Links:')
        this.links.forEach((link) => {
            printLink(link)
        })
        console.log('-------------')
    }

    p5Draw() {
        new p5((p: any)=>{
            p.setup = () => {
                p.createCanvas(1920,1080);
                p.noLoop();
            };
        
            p.draw = function() {
                p.background(0);
                p.fill(255);
                p.rect(10,10, 50, 50);
                fs.promises.writeFile(path.join(__dirname,"..","test.png"), p.canvas.toBuffer())
            };
        })
    }
}

const netConfig: NetworkConfig = {
    squash: squashFunctions.Linear,
    evalIterations: 100,
}

const net = new Network(2, 3, netConfig)
net.addLink(net.maxInno(), 0, 2, 2)
net.addLink(net.maxInno(), 1, 2, 1)
net.addLink(net.maxInno(), 0, 3, 3)
net.addLink(net.maxInno(), 1, 3, -1)
net.print()
net.p5Draw();

printList(net.eval([2, -3]))


module.exports = {
    NodeType: NodeType,
    Network: Network,
}
