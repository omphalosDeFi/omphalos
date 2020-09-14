pragma solidity 0.4.24;

import "./Mock.sol";


contract MockOmphalosPolicy is Mock {
    
    function rebase() external {
        emit FunctionCalled("OmphalosPolicy", "rebase", msg.sender);
    }
}
